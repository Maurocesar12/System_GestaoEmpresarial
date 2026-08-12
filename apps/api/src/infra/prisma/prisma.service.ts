import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';
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
   * @param connectionString URL do banco. Em produção vem de `DATABASE_URL`;
   *   os testes de isolamento passam a URL do banco de teste.
   */
  constructor(connectionString: string = process.env.DATABASE_URL ?? '') {
    if (!connectionString) {
      throw new Error(
        'DATABASE_URL não definida. Rode scripts/setup-database.ps1 para criar o banco de desenvolvimento.',
      );
    }

    super({ adapter: criarAdaptador(connectionString) });
  }

  /**
   * O mesmo cliente, com a extensão que carimba o tenant (camada 2).
   * É por aqui que `comTenant()` trabalha.
   */
  private readonly comEscopo = aplicarExtensao(this);

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Conectado ao banco.');
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
   * Executa `operacao` definindo o tenant explicitamente, sem depender do
   * contexto da requisição.
   *
   * Existe para o cadastro self-service: a empresa acabou de ser criada, o
   * usuário ainda não fez login, e mesmo assim é preciso gravar o primeiro
   * usuário e as etapas do funil já sob o escopo dela. Também é o que os
   * testes de isolamento usam para simular duas empresas diferentes.
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
