import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CODIGOS_ERRO,
  paginar,
  type CategoriaFinanceira,
  type CategoriaFormInput,
  type FluxoDeCaixa,
  type Lancamento,
  type LancamentoFormInput,
  type LancamentosQuery,
  type MargemPorServico,
  type Paginado,
  type PeriodoQuery,
  type RelatorioMargem,
} from '@gestao/shared-types';
import { uuidv7 } from '../../common/uuid';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService, type TransacaoComTenant } from '../../infra/prisma/prisma.service';
import { tenantAtual } from '../../infra/tenant/tenant-context';

const ZERO = new Prisma.Decimal(0);

const INCLUDE_PADRAO = {
  categoria: { select: { nome: true } },
  servico: { select: { nome: true } },
  cliente: { select: { nome: true } },
} as const;

/**
 * O registro como ele volta do banco, derivado do próprio schema.
 *
 * Escrever este tipo à mão significaria mantê-lo sincronizado com o Prisma na
 * unha, e o TypeScript não avisaria quando os dois divergissem.
 */
type LancamentoBanco = Prisma.LancamentoFinanceiroGetPayload<{
  include: typeof INCLUDE_PADRAO;
}>;

/**
 * Financeiro: lançamentos, categorias e os relatórios que deles derivam.
 *
 * **Toda soma acontece no banco**, com `groupBy` e `aggregate` sobre colunas
 * `NUMERIC`. Somar em JavaScript traria os registros para a memória e faria a
 * conta em ponto flutuante — o erro de centavos que o `NUMERIC` existe para
 * evitar voltaria justamente no número que o dono usa para decidir preço.
 */
@Injectable()
export class FinanceiroService {
  constructor(private readonly prisma: PrismaService) {}

  // --- Categorias ----------------------------------------------------------

  async listarCategorias(): Promise<CategoriaFinanceira[]> {
    const categorias = await this.prisma.comTenant((tx) =>
      tx.categoriaFinanceira.findMany({ orderBy: { nome: 'asc' } }),
    );

    return categorias.map((categoria) => ({
      id: categoria.id,
      nome: categoria.nome,
      tipoCusto: categoria.tipoCusto,
      criadoEm: categoria.criadoEm.toISOString(),
    }));
  }

  async criarCategoria(dados: CategoriaFormInput): Promise<CategoriaFinanceira> {
    const categoria = await this.prisma.comTenant(async (tx) => {
      const existente = await tx.categoriaFinanceira.findFirst({
        where: { nome: dados.nome },
        select: { id: true },
      });

      if (existente) {
        throw new ConflictException({
          codigo: CODIGOS_ERRO.CONFLITO,
          mensagem: 'Já existe uma categoria com este nome.',
        });
      }

      return tx.categoriaFinanceira.create({
        data: { id: uuidv7(), tenantId: tenantAtual(), ...dados },
      });
    });

    return {
      id: categoria.id,
      nome: categoria.nome,
      tipoCusto: categoria.tipoCusto,
      criadoEm: categoria.criadoEm.toISOString(),
    };
  }

  /**
   * Remove uma categoria.
   *
   * Recusa se houver lançamento usando. Apagar desvincularia registros do
   * passado, e o relatório de custo fixo do mês anterior mudaria sozinho.
   */
  async removerCategoria(id: string): Promise<void> {
    await this.prisma.comTenant(async (tx) => {
      const emUso = await tx.lancamentoFinanceiro.count({ where: { categoriaId: id } });

      if (emUso > 0) {
        throw new BadRequestException({
          codigo: CODIGOS_ERRO.CONFLITO,
          mensagem: `Esta categoria tem ${emUso} lançamento(s). Reclassifique-os antes de excluí-la.`,
        });
      }

      const removidas = await tx.categoriaFinanceira.deleteMany({ where: { id } });

      if (removidas.count === 0) {
        throw new NotFoundException({
          codigo: CODIGOS_ERRO.NAO_ENCONTRADO,
          mensagem: 'Categoria não encontrada.',
        });
      }
    });
  }

  // --- Lançamentos ---------------------------------------------------------

  async listar(query: LancamentosQuery): Promise<Paginado<Lancamento>> {
    const where = this.montarFiltro(query);

    const [registros, total] = await this.prisma.comTenant((tx) =>
      Promise.all([
        tx.lancamentoFinanceiro.findMany({
          where,
          include: INCLUDE_PADRAO,
          // Mais recente primeiro: extrato se lê de trás para frente.
          orderBy: [{ data: 'desc' }, { criadoEm: 'desc' }],
          skip: (query.pagina - 1) * query.porPagina,
          take: query.porPagina,
        }),
        tx.lancamentoFinanceiro.count({ where }),
      ]),
    );

    return paginar(
      registros.map((registro) => this.paraResposta(registro)),
      total,
      query,
    );
  }

  async criar(dados: LancamentoFormInput): Promise<Lancamento> {
    const lancamento = await this.prisma.comTenant(async (tx) => {
      await this.garantirVinculosValidos(tx, dados);

      return tx.lancamentoFinanceiro.create({
        data: { id: uuidv7(), tenantId: tenantAtual(), ...this.paraBanco(dados) },
        include: INCLUDE_PADRAO,
      });
    });

    return this.paraResposta(lancamento);
  }

  /**
   * Atualiza um lançamento.
   *
   * A checagem de existência acontece **dentro** da mesma transação da escrita.
   * Buscar antes, por fora, custaria uma transação inteira a mais (`BEGIN` +
   * `set_config` + consulta + `COMMIT`) sem ganhar atomicidade nenhuma.
   */
  async atualizar(id: string, dados: LancamentoFormInput): Promise<Lancamento> {
    const lancamento = await this.prisma.comTenant(async (tx) => {
      await Promise.all([this.garantirExiste(tx, id), this.garantirVinculosValidos(tx, dados)]);

      return tx.lancamentoFinanceiro.update({
        where: { id },
        data: this.paraBanco(dados),
        include: INCLUDE_PADRAO,
      });
    });

    return this.paraResposta(lancamento);
  }

  async buscarPorId(id: string): Promise<Lancamento> {
    const lancamento = await this.prisma.comTenant((tx) =>
      tx.lancamentoFinanceiro.findUnique({ where: { id }, include: INCLUDE_PADRAO }),
    );

    if (!lancamento) {
      throw new NotFoundException({
        codigo: CODIGOS_ERRO.NAO_ENCONTRADO,
        mensagem: 'Lançamento não encontrado.',
      });
    }

    return this.paraResposta(lancamento);
  }

  async remover(id: string): Promise<void> {
    // O `deleteMany` sob RLS só apaga o que é do tenant; contar o resultado
    // distingue "não existe" de "é de outra empresa" sem uma consulta extra.
    const { count } = await this.prisma.comTenant((tx) =>
      tx.lancamentoFinanceiro.deleteMany({ where: { id } }),
    );

    if (count === 0) {
      throw new NotFoundException({
        codigo: CODIGOS_ERRO.NAO_ENCONTRADO,
        mensagem: 'Lançamento não encontrado.',
      });
    }
  }

  // --- Relatórios ----------------------------------------------------------

  /**
   * Fluxo de caixa do período.
   *
   * Ignora lançamentos pessoais por padrão: misturá-los ao caixa da empresa
   * distorceria o custo operacional e, por consequência, toda decisão de preço.
   */
  async fluxoDeCaixa(query: PeriodoQuery): Promise<FluxoDeCaixa> {
    const where = this.filtroDePeriodo(query);

    // As quatro somas são independentes e vão juntas ao banco. Trazer as saídas
    // linha a linha para somar em JavaScript custaria uma transferência
    // proporcional ao movimento do mês para produzir dois números.
    const [porTipo, fixo, variavel] = await this.prisma.comTenant((tx) =>
      Promise.all([
        tx.lancamentoFinanceiro.groupBy({ by: ['tipo'], where, _sum: { valor: true } }),
        // Saída sem categoria não entra em nenhum dos dois: classificá-la por
        // suposição inventaria um número.
        tx.lancamentoFinanceiro.aggregate({
          where: { ...where, tipo: 'saida', categoria: { tipoCusto: 'fixo' } },
          _sum: { valor: true },
        }),
        tx.lancamentoFinanceiro.aggregate({
          where: { ...where, tipo: 'saida', categoria: { tipoCusto: 'variavel' } },
          _sum: { valor: true },
        }),
      ]),
    );

    const entradas = porTipo.find((g) => g.tipo === 'entrada')?._sum.valor ?? ZERO;
    const saidas = porTipo.find((g) => g.tipo === 'saida')?._sum.valor ?? ZERO;

    return {
      entradas: entradas.toFixed(2),
      saidas: saidas.toFixed(2),
      saldo: entradas.minus(saidas).toFixed(2),
      custoFixo: (fixo._sum.valor ?? ZERO).toFixed(2),
      custoVariavel: (variavel._sum.valor ?? ZERO).toFixed(2),
      periodo: { de: query.de, ate: query.ate },
    };
  }

  /**
   * Margem por tipo de serviço.
   *
   * Este é o relatório que justifica CRM e financeiro viverem no mesmo banco
   * (§1). Ele responde a pergunta que o dono não consegue responder com
   * planilha: *qual serviço realmente dá lucro?*
   */
  async margemPorServico(query: PeriodoQuery): Promise<RelatorioMargem> {
    const where = this.filtroDePeriodo(query);

    const [grupos, servicos] = await this.prisma.comTenant((tx) =>
      Promise.all([
        // Uma passada só: receita e custo de todos os serviços, agrupados pelo
        // banco. A alternativa — uma consulta por serviço — multiplicaria as
        // idas ao banco pelo tamanho do catálogo.
        tx.lancamentoFinanceiro.groupBy({
          by: ['servicoId', 'tipo'],
          where,
          _sum: { valor: true },
          _count: { _all: true },
        }),
        tx.servico.findMany({ select: { id: true, nome: true } }),
      ]),
    );

    const nomePorServico = new Map(servicos.map((servico) => [servico.id, servico.nome]));
    const acumulado = new Map<
      string,
      { receita: Prisma.Decimal; custo: Prisma.Decimal; quantidade: number }
    >();

    let receitaSemServico = ZERO;

    for (const grupo of grupos) {
      const valor = grupo._sum.valor ?? ZERO;

      // Receita sem serviço vinculado fica de fora das margens, mas é reportada
      // à parte — uma lacuna visível é melhor que um número silenciosamente
      // incompleto.
      if (!grupo.servicoId) {
        if (grupo.tipo === 'entrada') {
          receitaSemServico = receitaSemServico.plus(valor);
        }
        continue;
      }

      const atual = acumulado.get(grupo.servicoId) ?? {
        receita: ZERO,
        custo: ZERO,
        quantidade: 0,
      };

      if (grupo.tipo === 'entrada') {
        atual.receita = atual.receita.plus(valor);
        atual.quantidade += grupo._count._all;
      } else {
        atual.custo = atual.custo.plus(valor);
      }

      acumulado.set(grupo.servicoId, atual);
    }

    const itens: MargemPorServico[] = [...acumulado.entries()]
      .map(([servicoId, { receita, custo, quantidade }]) => {
        const margem = receita.minus(custo);

        return {
          servicoId,
          servicoNome: nomePorServico.get(servicoId) ?? 'Serviço removido',
          receita: receita.toFixed(2),
          custo: custo.toFixed(2),
          margem: margem.toFixed(2),
          // Percentual só faz sentido com receita: dividir por zero não é
          // "margem zero", é pergunta sem resposta.
          margemPercentual: receita.isZero()
            ? null
            : Number(margem.dividedBy(receita).times(100).toFixed(1)),
          quantidade,
        };
      })
      // Maior margem primeiro: a pergunta é "o que dá mais lucro?".
      .sort((a, b) => Number(b.margem) - Number(a.margem));

    return {
      itens,
      receitaSemServico: receitaSemServico.toFixed(2),
      periodo: { de: query.de, ate: query.ate },
    };
  }

  // --- Apoio ---------------------------------------------------------------

  /** O recorte de período compartilhado pelos dois relatórios. */
  private filtroDePeriodo(query: PeriodoQuery): Prisma.LancamentoFinanceiroWhereInput {
    return {
      data: {
        gte: new Date(`${query.de}T00:00:00Z`),
        lte: new Date(`${query.ate}T23:59:59.999Z`),
      },
      natureza: query.natureza ?? 'empresa',
    };
  }

  private montarFiltro(query: LancamentosQuery): Prisma.LancamentoFinanceiroWhereInput {
    const where: Prisma.LancamentoFinanceiroWhereInput = {};

    if (query.tipo) where.tipo = query.tipo;
    if (query.natureza) where.natureza = query.natureza;
    if (query.categoriaId) where.categoriaId = query.categoriaId;
    if (query.servicoId) where.servicoId = query.servicoId;

    if (query.de || query.ate) {
      where.data = {
        ...(query.de ? { gte: new Date(`${query.de}T00:00:00Z`) } : {}),
        ...(query.ate ? { lte: new Date(`${query.ate}T23:59:59.999Z`) } : {}),
      };
    }

    return where;
  }

  /**
   * As colunas gravadas, iguais no `create` e no `update`.
   *
   * A data chega como `YYYY-MM-DD` e é fixada em meia-noite UTC. Sem o `Z`, o
   * servidor interpretaria no fuso dele e a data mudaria de dia conforme onde a
   * aplicação estivesse rodando.
   */
  private paraBanco(dados: LancamentoFormInput) {
    return {
      tipo: dados.tipo,
      natureza: dados.natureza,
      descricao: dados.descricao,
      valor: dados.valor,
      data: new Date(`${dados.data}T00:00:00Z`),
      categoriaId: dados.categoriaId,
      servicoId: dados.servicoId,
      clienteId: dados.clienteId,
    };
  }

  private async garantirExiste(tx: TransacaoComTenant, id: string): Promise<void> {
    const existe = await tx.lancamentoFinanceiro.findUnique({ where: { id }, select: { id: true } });

    if (!existe) {
      throw new NotFoundException({
        codigo: CODIGOS_ERRO.NAO_ENCONTRADO,
        mensagem: 'Lançamento não encontrado.',
      });
    }
  }

  private async garantirVinculosValidos(
    tx: TransacaoComTenant,
    dados: LancamentoFormInput,
  ): Promise<void> {
    // As três verificações em paralelo: são independentes entre si.
    const [categoria, servico, cliente] = await Promise.all([
      dados.categoriaId
        ? tx.categoriaFinanceira.findUnique({
            where: { id: dados.categoriaId },
            select: { id: true },
          })
        : null,
      dados.servicoId
        ? tx.servico.findUnique({ where: { id: dados.servicoId }, select: { id: true } })
        : null,
      dados.clienteId
        ? tx.cliente.findUnique({ where: { id: dados.clienteId }, select: { id: true } })
        : null,
    ]);

    if (dados.categoriaId && !categoria) {
      throw new NotFoundException({
        codigo: CODIGOS_ERRO.NAO_ENCONTRADO,
        mensagem: 'Categoria não encontrada.',
      });
    }

    if (dados.servicoId && !servico) {
      throw new NotFoundException({
        codigo: CODIGOS_ERRO.NAO_ENCONTRADO,
        mensagem: 'Serviço não encontrado.',
      });
    }

    if (dados.clienteId && !cliente) {
      throw new NotFoundException({
        codigo: CODIGOS_ERRO.NAO_ENCONTRADO,
        mensagem: 'Cliente não encontrado.',
      });
    }
  }

  private paraResposta(registro: LancamentoBanco): Lancamento {
    return {
      id: registro.id,
      tipo: registro.tipo,
      natureza: registro.natureza,
      descricao: registro.descricao,
      valor: registro.valor.toFixed(2),
      data: registro.data.toISOString().slice(0, 10),
      categoriaId: registro.categoriaId,
      categoriaNome: registro.categoria?.nome ?? null,
      servicoId: registro.servicoId,
      servicoNome: registro.servico?.nome ?? null,
      clienteId: registro.clienteId,
      clienteNome: registro.cliente?.nome ?? null,
      criadoEm: registro.criadoEm.toISOString(),
    };
  }
}
