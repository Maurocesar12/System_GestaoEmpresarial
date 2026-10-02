import {
  Inject,
  Injectable,
  Logger,
  Optional,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { uuidv7 } from '../../common/uuid';
import { Prisma, PrismaClient } from '../../generated/prisma/client';
import { exigirContextoTenant, obterContextoTenant } from '../tenant/tenant-context';
import { criarExtensaoTenant } from './tenant.extension';

/**
 * Monta a conexão a partir da URL.
 *
 * A partir do Prisma 7 o cliente não abre a conexão sozinho: ele recebe um
 * *driver adapter*, que aqui é o driver `pg` do PostgreSQL. Passar a URL
 * explicitamente também é o que permite aos testes apontarem para o banco de
 * teste sem mexer em variável de ambiente global.
 */
function criarAdaptador(connectionString: string): PrismaPg {
  return new PrismaPg({ connectionString });
}

/**
 * Token de injeção da URL do banco.
 *
 * Sem um token, o NestJS tentaria resolver o parâmetro `connectionString: string`
 * do construtor procurando um provider do tipo `String` — que não existe — e a
 * aplicação nem subiria. Um símbolo dedicado diz ao Nest exatamente o que
 * injetar ali.
 */
export const URL_DO_BANCO = Symbol('URL_DO_BANCO');

/**
 * As rotinas que podem ler sem empresa no contexto, cada uma com a sua
 * política no banco (migration `20261001120000_politicas_declaradas`).
 */
export type Varredura = 'lembretes' | 'recorrencias' | 'expurgo';

/**
 * Conexão com o banco.
 *
 * Esta classe existe por causa de um detalhe que não é óbvio: a política de RLS
 * do PostgreSQL lê o tenant de uma variável **da sessão de banco**
 * (`app.current_tenant_id`), e não da requisição HTTP. Alguém precisa levar o
 * tenant de um lugar ao outro — é o que `comTenant()` faz.
 *
 * Sobre o pool de conexões: o Prisma reaproveita conexões entre requisições.
 * Se definíssemos a variável com `SET` comum, ela ficaria grudada na conexão e
 * a próxima requisição — de outra empresa — herdaria o tenant errado. Por isso
 * o valor é definido dentro de uma transação, com escopo local: ao fim dela,
 * é descartado automaticamente.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  /**
   * @param connectionString URL do banco. Na aplicação, o PrismaModule a injeta
   *   pelo token `URL_DO_BANCO`; os testes de isolamento passam a URL do banco
   *   de teste instanciando a classe diretamente.
   */
  constructor(@Optional() @Inject(URL_DO_BANCO) connectionString?: string) {
    const url = connectionString ?? process.env.DATABASE_URL ?? '';

    if (!url) {
      throw new Error(
        'DATABASE_URL não definida. Rode scripts/setup-database.ps1 para criar o banco de desenvolvimento.',
      );
    }

    super({ adapter: criarAdaptador(url) });
  }

  /**
   * O mesmo cliente, com a extensão que carimba o tenant (camada 2).
   * É por aqui que `comTenant()` trabalha.
   */
  private readonly comEscopo = aplicarExtensao(this);

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Conectado ao banco.');
    await this.garantirPapelSemBypass();
  }

  /**
   * Recusa subir em produção com um papel que ignora a RLS.
   *
   * A RLS é a camada que vale mesmo com bug no código — mas só para papéis
   * sem `BYPASSRLS` e que não sejam superusuário. O papel padrão do Neon
   * (`neondb_owner`) tem `BYPASSRLS`, e com ele as políticas existem, estão
   * certas e não filtram nada. Foi assim que a produção ficou: isolada só pelo
   * código, sem ninguém perceber.
   *
   * Em produção, falhar ao subir é melhor que subir aberto: o deploy quebra,
   * o log diz o motivo, e nenhuma empresa enxerga a outra nesse meio-tempo.
   * Fora de produção só avisa — o banco local de desenvolvimento costuma usar
   * o superusuário, e travar ali não protegeria dado de ninguém.
   */
  private async garantirPapelSemBypass(): Promise<void> {
    const [papel] = await this.$queryRaw<
      Array<{ nome: string; bypass: boolean; superusuario: boolean }>
    >`SELECT rolname AS nome, rolbypassrls AS bypass, rolsuper AS superusuario
        FROM pg_roles WHERE rolname = current_user`;

    if (!papel || (!papel.bypass && !papel.superusuario)) {
      return;
    }

    const mensagem =
      `O papel "${papel.nome}" ignora a RLS (${papel.superusuario ? 'superusuário' : 'BYPASSRLS'}). ` +
      'Conecte a aplicação com o papel gestao_app (DATABASE_URL) e deixe o papel dono só para ' +
      'migrations (ADMIN_DATABASE_URL). Veja apps/api/prisma/papel-aplicacao.sql.';

    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Recusando subir: ${mensagem}`);
    }

    this.logger.warn(`Isolamento entre empresas só pelo código neste ambiente. ${mensagem}`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * Executa `operacao` com o tenant do contexto atual aplicado no banco.
   *
   * Tudo que toca dados de uma empresa passa por aqui. Por dentro:
   *
   *   1. Lê o tenant do contexto da requisição — e falha se não houver
   *   2. Abre uma transação
   *   3. Define `app.current_tenant_id` só para aquela transação
   *   4. Roda a operação, agora com a RLS ativa e enxergando um tenant só
   *
   * @example
   * const clientes = await this.prisma.comTenant((tx) =>
   *   tx.cliente.findMany({ orderBy: { nome: 'asc' } }),
   * );
   */
  async comTenant<T>(operacao: (tx: TransacaoComTenant) => Promise<T>): Promise<T> {
    // Falha aqui é intencional e não deve virar fallback: consulta sem tenant
    // é o caminho por onde dado de uma empresa vaza para outra.
    const { tenantId } = exigirContextoTenant();

    return this.comEscopo.$transaction(async (tx) => {
      // `set_config(nome, valor, true)` é o equivalente de SET LOCAL aceitando
      // parâmetro — necessário porque SET LOCAL não aceita placeholder. O
      // terceiro argumento `true` é o que restringe o efeito a esta transação.
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}::text, true)`;

      return operacao(tx);
    });
  }

  /**
   * Executa `operacao` sem tenant no contexto.
   *
   * Reservado para o que é genuinamente global: autenticar alguém antes de
   * saber a que empresa pertence, ler o catálogo de planos, processar webhook
   * de pagamento. **Não é atalho para "a consulta não está funcionando"** — a
   * RLS continua ativa, e sem contexto ela não devolve nenhuma linha de tabela
   * isolada.
   *
   * O parâmetro `motivo` é obrigatório para que cada uso deixe registrado por
   * que precisou escapar do escopo de tenant.
   */
  async semTenant<T>(motivo: string, operacao: (cliente: PrismaClient) => Promise<T>): Promise<T> {
    if (obterContextoTenant()) {
      this.logger.warn(
        `semTenant("${motivo}") chamado dentro de um contexto de tenant — confira se é mesmo necessário.`,
      );
    }

    return operacao(this);
  }

  /**
   * Lê `usuario` pelo e-mail, antes de saber a empresa — login, recuperação de
   * senha, checagem de e-mail duplicado.
   *
   * A política `usuario_login` só libera a linha cujo e-mail é o declarado em
   * `app.login_email`, e só dentro desta transação. Antes ela liberava a tabela
   * **inteira** sempre que não havia empresa no contexto: qualquer consulta
   * esquecida fora de `comTenant()` enxergava as contas — e os hashes de senha —
   * de todas as empresas. Agora uma consulta assim não vê nada.
   */
  async comEmailDeLogin<T>(
    email: string,
    motivo: string,
    operacao: (db: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    this.logger.debug(`comEmailDeLogin: ${motivo}`);

    return this.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.login_email', ${email}::text, true)`;
      return operacao(tx);
    });
  }

  /**
   * Roda uma varredura que precisa enxergar todas as empresas: lembretes
   * vencidos, recorrências a gerar, contas canceladas a excluir.
   *
   * Cada varredura tem uma política própria que só vale com `app.varredura`
   * igual ao nome dela. Sem a declaração, a consulta não vê nada — a política
   * deixa de ser "qualquer coisa sem contexto" e passa a ser "esta rotina,
   * que disse quem é".
   */
  async comVarredura<T>(
    varredura: Varredura,
    motivo: string,
    operacao: (db: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    if (obterContextoTenant()) {
      // Com contexto, a política da varredura nem se aplica — e quem pediu
      // provavelmente queria `comTenant()`.
      throw new Error(
        `comVarredura("${varredura}") chamada dentro de um contexto de tenant: ${motivo}`,
      );
    }

    return this.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.varredura', ${varredura}::text, true)`;
      return operacao(tx);
    });
  }

  /**
   * Executa `operacao` definindo o tenant explicitamente, sem depender do
   * contexto da requisição.
   *
   * Serve a dois casos: os workers do BullMQ, que restauram o tenant a partir
   * do payload do job, e os testes de isolamento, que precisam alternar entre
   * duas empresas.
   */
  async comTenantExplicito<T>(
    tenantId: string,
    operacao: (tx: TransacaoComTenant) => Promise<T>,
  ): Promise<T> {
    return this.comEscopo.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}::text, true)`;
      return operacao(tx);
    });
  }

  /**
   * Cria uma empresa nova e roda `operacao` já dentro do escopo dela.
   *
   * O cadastro self-service tem um problema de ovo e galinha: a política de RLS
   * exige um tenant no contexto, mas o tenant é justamente o que está sendo
   * criado. A saída é gerar o identificador **aqui**, e não deixar o banco
   * gerá-lo: com o id em mãos antes do INSERT, o contexto é definido primeiro e
   * a política aprova a linha normalmente.
   *
   * Isso importa mais do que parece. O Prisma usa `RETURNING` no `create` para
   * devolver o registro, e sob RLS o `RETURNING` exige que a linha também possa
   * ser **lida** de volta. Sem contexto, ela não pode — e o INSERT falha mesmo
   * que a gravação em si fosse permitida.
   *
   * UUID v7 em vez de v4 porque ele começa com o instante de criação: os
   * registros nascem em ordem cronológica e o índice da chave primária não
   * fragmenta a cada inserção.
   *
   * @param dados Campos da empresa, sem o `id` — quem o define é este método.
   */
  async criarNovoTenant<T>(
    dados: Omit<Prisma.TenantCreateInput, 'id'>,
    operacao: (tx: TransacaoComTenant, tenantId: string) => Promise<T>,
  ): Promise<T> {
    const tenantId = uuidv7();

    return this.comEscopo.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}::text, true)`;

      await tx.tenant.create({ data: { ...dados, id: tenantId } });

      return operacao(tx, tenantId);
    });
  }
}

/**
 * Aplica a extensão a um cliente. Serve tanto em tempo de execução quanto para
 * derivar o tipo abaixo, evitando escrever à mão o tipo do cliente estendido —
 * que o Prisma monta com generics e mudaria a cada alteração no schema.
 */
function aplicarExtensao(cliente: PrismaClient) {
  return cliente.$extends(criarExtensaoTenant());
}

type ClienteComEscopo = ReturnType<typeof aplicarExtensao>;

/**
 * O cliente de dentro de uma transação, já com a extensão de tenant aplicada.
 * Não expõe os métodos que não fazem sentido aninhados numa transação.
 */
export type TransacaoComTenant = Omit<
  ClienteComEscopo,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'
>;
