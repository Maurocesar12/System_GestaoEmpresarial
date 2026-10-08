import { Injectable } from '@nestjs/common';
import {
  paginar,
  type Cliente,
  type ClienteFormInput,
  type ClienteIgnorado,
  type ClientesQuery,
  type Paginado,
  type ResultadoImportacao,
} from '@gestao/shared-types';
import { uuidv7 } from '../../../common/uuid';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { tenantAtual } from '../../../infra/tenant/tenant-context';
import { FunilService } from '../funil/funil.service';
import { AuditoriaService } from '../../plataforma/auditoria/auditoria.service';
import { naoEncontrado, conflito } from '../../../common/erros';
import {
  montarFiltro,
  garantirLimiteClientes,
  buscarRepetidos,
  motivoParaIgnorar,
  colocarLoteNoFunil,
  paraResposta,
  paraBancoCliente,
  garantirPersonalizacao,
  salvarEtiquetas,
} from './clientes-banco';

/**
 * Clientes da empresa.
 *
 * Nenhum método filtra por empresa explicitamente, e isso é o esperado: todo
 * acesso passa por `prisma.comTenant`, que define o tenant da sessão de banco
 * antes de qualquer consulta. O isolamento vem das três camadas descritas em
 * §4.2, não de um `where` que alguém precise lembrar de escrever.
 */
@Injectable()
export class ClientesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly funil: FunilService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async listar(query: ClientesQuery): Promise<Paginado<Cliente>> {
    const where = montarFiltro(query.busca, query.origem);

    // As duas consultas na mesma transação, e não em sequência: se um cliente
    // for cadastrado entre elas, o total e a página devolvida ficariam
    // inconsistentes — a paginação mostraria "21 clientes" com 20 na lista.
    const [registros, total] = await this.prisma.comTenant((tx) =>
      Promise.all([
        tx.cliente.findMany({
          where,
          include: { etiquetas: { select: { etiquetaId: true } } },
          orderBy: { nome: 'asc' },
          skip: (query.pagina - 1) * query.porPagina,
          take: query.porPagina,
        }),
        tx.cliente.count({ where }),
      ]),
    );

    return paginar(
      registros.map((registro) => paraResposta(registro)),
      total,
      query,
    );
  }

  async buscarPorId(id: string): Promise<Cliente> {
    const cliente = await this.prisma.comTenant((tx) =>
      tx.cliente.findUnique({
        where: { id },
        // A posição no funil vem junto, numa consulta só.
        //
        // Antes, a ficha do cliente baixava o **quadro inteiro** — todas as
        // etapas, todos os clientes, todos os orçamentos em aberto — apenas
        // para descobrir em qual coluna este cliente estava. Com cinquenta
        // clientes no funil, era uma consulta pesada para extrair um campo.
        include: {
          posicaoFunil: {
            select: { etapa: { select: { id: true, nome: true } } },
          },
          etiquetas: { select: { etiquetaId: true } },
        },
      }),
    );

    // Cliente de outra empresa cai aqui como "não encontrado", e não como "sem
    // permissão". A diferença importa: responder 403 confirmaria que aquele id
    // existe em algum lugar do sistema.
    if (!cliente) {
      throw naoEncontrado('Cliente não encontrado.');
    }

    return {
      ...paraResposta(cliente),
      etapaFunil: cliente.posicaoFunil
        ? { id: cliente.posicaoFunil.etapa.id, nome: cliente.posicaoFunil.etapa.nome }
        : null,
    };
  }

  async criar(dados: ClienteFormInput): Promise<Cliente> {
    const { cliente, etapa } = await this.prisma.comTenant(async (tx) => {
      await garantirLimiteClientes(tx, tenantAtual());

      await garantirPersonalizacao(tx, dados);
      const criado = await tx.cliente.create({
        data: { id: uuidv7(), tenantId: tenantAtual(), ...paraBancoCliente(dados) },
        include: { etiquetas: { select: { etiquetaId: true } } },
      });

      await salvarEtiquetas(tx, criado.id, dados.etiquetas);

      // Todo cliente novo entra no funil, na primeira etapa. O cadastro é o
      // início da relação comercial, e um funil que só recebe quem alguém
      // lembrou de arrastar mostra menos do que a realidade.
      //
      // Na mesma transação: se a entrada no funil falhar, o cadastro é desfeito
      // junto — nada de cliente existindo pela metade.
      const etapa = await this.funil.colocarNaPrimeiraEtapa(tx, criado.id);

      await this.auditoria.registrar(tx, {
        entidade: 'cliente',
        entidadeId: criado.id,
        acao: 'criou',
        resumo: `Cliente criado: ${criado.nome}`,
        depois: paraResposta(criado),
      });

      return { cliente: criado, etapa };
    });

    // A etapa vai na resposta para o contrato ficar igual ao do `GET /clientes/:id`.
    // Sem isso, a tela precisaria de uma segunda requisição só para saber onde o
    // cliente caiu no funil.
    return {
      ...paraResposta(cliente),
      etiquetas: [...new Set(dados.etiquetas)],
      etapaFunil: etapa,
    };
  }

  /**
   * Cria vários clientes de uma vez, a partir de uma planilha.
   *
   * ## Por que não é um laço chamando `criar()`
   *
   * `criar()` faz seis idas ao banco por cliente — trava do tenant, contagem do
   * limite, inserção, busca da primeira etapa, checagem de funil e inserção no
   * funil. Repetido 500 vezes seriam três mil consultas, e a transação ficaria
   * aberta tempo suficiente para segurar outras requisições da mesma empresa.
   *
   * Este método faz **seis consultas no total**, independente de o lote ter uma
   * linha ou quinhentas: trava, limite, busca de repetidos, inserção dos
   * clientes, busca da primeira etapa e inserção no funil.
   *
   * ## O que ele recusa e o que ele pula
   *
   * Estourar o limite do plano **falha o lote inteiro**, sem gravar nada:
   * importar 300 de 500 clientes e avisar depois deixaria o usuário sem saber
   * quais entraram. Já uma linha repetida apenas é pulada e volta na resposta
   * com o motivo — repetição é comum em planilha e não justifica descartar o
   * trabalho todo.
   */
  async importar(clientes: ClienteFormInput[]): Promise<ResultadoImportacao> {
    return this.prisma.comTenant(async (tx) => {
      await garantirLimiteClientes(tx, tenantAtual(), clientes.length);

      const ignorados: ClienteIgnorado[] = [];
      const aCriar: { indice: number; dados: ClienteFormInput }[] = [];

      // Repetições dentro do próprio arquivo, resolvidas em memória: a primeira
      // ocorrência entra, as seguintes são puladas.
      const documentosVistos = new Set<string>();
      const emailsVistos = new Set<string>();

      // Uma consulta só para descobrir o que já existe. Uma por linha
      // multiplicaria as idas ao banco pelo tamanho da planilha.
      const { documentos: documentosExistentes, emails: emailsExistentes } = await buscarRepetidos(
        tx,
        clientes,
      );

      clientes.forEach((dados, indice) => {
        const motivo = motivoParaIgnorar(dados, {
          documentosExistentes,
          emailsExistentes,
          documentosVistos,
          emailsVistos,
        });

        if (motivo) {
          ignorados.push({ indice, nome: dados.nome, motivo });
          return;
        }

        if (dados.documento) documentosVistos.add(dados.documento);
        if (dados.email) emailsVistos.add(dados.email);

        aCriar.push({ indice, dados });
      });

      if (aCriar.length === 0) {
        return { criados: 0, ignorados };
      }

      // O id é gerado aqui, e não pelo banco, porque as linhas do funil
      // precisam apontar para esses clientes na mesma transação — sem os ids em
      // mãos, seria preciso reler o que acabou de ser inserido.
      const novos = aCriar.map(({ dados }) => ({
        id: uuidv7(),
        tenantId: tenantAtual(),
        ...paraBancoCliente(dados),
      }));

      await tx.cliente.createMany({ data: novos });

      await colocarLoteNoFunil(
        tx,
        novos.map((cliente) => cliente.id),
      );

      for (const novo of novos) {
        await this.auditoria.registrar(tx, {
          entidade: 'cliente',
          entidadeId: novo.id,
          acao: 'criou',
          resumo: `Cliente importado: ${novo.nome}`,
          depois: { ...novo },
        });
      }

      return { criados: novos.length, ignorados };
    });
  }

  async atualizar(id: string, dados: ClienteFormInput): Promise<Cliente> {
    const cliente = await this.prisma.comTenant(async (tx) => {
      // Confere a existência dentro do escopo do tenant antes de alterar: sem
      // isso, o `update` de um id de outra empresa falharia com erro cru do
      // Prisma em vez de um 404 limpo.
      //
      // Na mesma transação da escrita, e buscando só o `id`: chamar
      // `buscarPorId` aqui abriria uma segunda transação e ainda traria a
      // posição no funil junto, que não é usada para nada nesta conferência.
      const existe = await tx.cliente.findUnique({
        where: { id },
        include: { etiquetas: { select: { etiquetaId: true } } },
      });

      if (!existe) {
        throw naoEncontrado('Cliente não encontrado.');
      }

      if (existe.anonimizadoEm) {
        throw conflito('Este cliente foi anonimizado a pedido do titular e não pode ser editado.');
      }

      await garantirPersonalizacao(tx, dados);
      const alterado = await tx.cliente.update({
        where: { id },
        data: paraBancoCliente(dados),
        include: { etiquetas: { select: { etiquetaId: true } } },
      });
      await salvarEtiquetas(tx, id, dados.etiquetas);
      await this.auditoria.registrar(tx, {
        entidade: 'cliente',
        entidadeId: id,
        acao: 'alterou',
        resumo: `Cliente alterado: ${alterado.nome}`,
        antes: paraResposta(existe),
        depois: paraResposta(alterado),
      });
      return alterado;
    });

    return { ...paraResposta(cliente), etiquetas: [...new Set(dados.etiquetas)] };
  }

  async remover(id: string): Promise<void> {
    // `deleteMany` em vez de `delete`: a RLS já garante o escopo, e assim uma
    // corrida (dois pedidos de exclusão ao mesmo tempo) não vira erro 500.
    // Contar o resultado dispensa a consulta prévia de existência.
    const { count } = await this.prisma.comTenant(async (tx) => {
      const cliente = await tx.cliente.findUnique({ where: { id } });
      const resultado = await tx.cliente.deleteMany({ where: { id } });
      if (cliente && resultado.count) {
        await this.auditoria.registrar(tx, {
          entidade: 'cliente',
          entidadeId: id,
          acao: 'excluiu',
          resumo: `Cliente excluído: ${cliente.nome}`,
          antes: paraResposta(cliente),
        });
      }
      return resultado;
    });

    if (count === 0) {
      throw naoEncontrado('Cliente não encontrado.');
    }
  }

  /**
   * Confere se ainda cabem `quantidade` clientes no plano.
   *
   * Serve tanto ao cadastro individual ("cabe mais um?") quanto à importação
   * ("cabem mais trezentos?"). A mensagem muda com o caso: no lote ela diz
   * quantas vagas restam, porque "limite excedido" sem número deixa o usuário
   * adivinhando quantas linhas apagar da planilha.
   */
  /**
   * Grava um lead vindo do formulário público do site (arquitetura §8.3).
   *
   * Mora aqui, e não no módulo de marketing, porque criar cliente é desta
   * casa: o limite do plano, a entrada no funil e o registro de auditoria são
   * as mesmas regras do cadastro normal, e duplicá-las lá seria garantir que
   * um dia divergissem.
   *
   * Roda com `comTenantExplicito` porque não há ninguém logado — a empresa vem
   * da chave do formulário, já conferida pelo `MarketingService`.
   *
   * O log de auditoria é escrito direto, sem passar pelo `AuditoriaService`:
   * aquele serviço lê o autor do contexto da requisição, e aqui não existe
   * autor. `usuarioId` nulo é a informação correta — quem criou este registro
   * foi um visitante do site, não um usuário do sistema.
   */
  async criarPeloFormulario(tenantId: string, dados: ClienteFormInput): Promise<void> {
    await this.prisma.comTenantExplicito(tenantId, async (tx) => {
      // Reenvio do mesmo contato não vira cliente novo.
      //
      // Isto é proteção, não só higiene de dados: sem ela, o formulário público
      // é um caminho para **esgotar a cota de clientes do plano**. Quinhentas
      // submissões enchem o limite do Básico, e a partir daí o assinante não
      // consegue mais cadastrar ninguém — uma negação de serviço barata, que o
      // limite por IP sozinho não impede.
      //
      // O critério é o mesmo da importação de planilha: repetido é quem tem o
      // mesmo e-mail ou telefone. Quem não informa nenhum dos dois nunca conta
      // como repetido — dois homônimos são duas pessoas.
      if (dados.email || dados.telefone) {
        const existente = await tx.cliente.findFirst({
          where: {
            anonimizadoEm: null,
            OR: [
              ...(dados.email ? [{ email: dados.email }] : []),
              ...(dados.telefone ? [{ telefone: dados.telefone }] : []),
            ],
          },
          select: { id: true },
        });

        if (existente) {
          return;
        }
      }

      await garantirLimiteClientes(tx, tenantId);

      const criado = await tx.cliente.create({
        data: { id: uuidv7(), tenantId, ...paraBancoCliente(dados) },
      });

      await this.funil.colocarNaPrimeiraEtapa(tx, criado.id);

      await tx.logAuditoria.create({
        data: {
          id: uuidv7(),
          tenantId,
          usuarioId: null,
          entidade: 'cliente',
          entidadeId: criado.id,
          acao: 'criou',
          resumo: `Lead recebido pelo formulário do site: ${criado.nome}`,
        },
      });
    });
  }
}
