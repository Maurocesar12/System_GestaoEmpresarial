import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CODIGOS_ERRO,
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
import { uuidv7 } from '../../../common/uuid';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { tenantAtual } from '../../../infra/tenant/tenant-context';

const ZERO = new Prisma.Decimal(0);

type LancamentoBanco = {
  id: string;
  tipo: 'entrada' | 'saida';
  natureza: 'pessoal' | 'empresa';
  descricao: string;
  valor: Prisma.Decimal;
  data: Date;
  categoriaId: string | null;
  servicoId: string | null;
  clienteId: string | null;
  criadoEm: Date;
  categoria: { nome: string } | null;
  servico: { nome: string } | null;
  cliente: { nome: string } | null;
};

const INCLUDE_PADRAO = {
  categoria: { select: { nome: true } },
  servico: { select: { nome: true } },
  cliente: { select: { nome: true } },
} as const;

/**
 * Financeiro: lançamentos, categorias e os relatórios que deles derivam.
 *
 * **Toda soma acontece no banco**, com `groupBy` e `aggregate` sobre colunas
 * `NUMERIC`. Somar em JavaScript traria os registros para a memória e faria a
 * conta em ponto flutuante — o erro de centavos que o `NUMERIC` existe para
 * evitar voltaria justamente no número que o dono usa para decidir preço.
 */
@Injectable()
export class LancamentosService {
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
    const { pagina, porPagina } = query;
    const where = this.montarFiltro(query);

    const [registros, total] = await this.prisma.comTenant((tx) =>
      Promise.all([
        tx.lancamentoFinanceiro.findMany({
          where,
          include: INCLUDE_PADRAO,
          // Mais recente primeiro: extrato se lê de trás para frente.
          orderBy: [{ data: 'desc' }, { criadoEm: 'desc' }],
          skip: (pagina - 1) * porPagina,
          take: porPagina,
        }),
        tx.lancamentoFinanceiro.count({ where }),
      ]),
    );

    return {
      dados: registros.map((registro) => this.paraResposta(registro)),
      meta: {
        pagina,
        porPagina,
        total,
        totalPaginas: Math.max(1, Math.ceil(total / porPagina)),
      },
    };
  }

  async criar(dados: LancamentoFormInput): Promise<Lancamento> {
    const lancamento = await this.prisma.comTenant(async (tx) => {
      await this.garantirVinculosValidos(tx, dados);

      return tx.lancamentoFinanceiro.create({
        data: {
          id: uuidv7(),
          tenantId: tenantAtual(),
          tipo: dados.tipo,
          natureza: dados.natureza,
          descricao: dados.descricao,
          valor: dados.valor,
          data: new Date(`${dados.data}T00:00:00Z`),
          categoriaId: dados.categoriaId,
          servicoId: dados.servicoId,
          clienteId: dados.clienteId,
        },
        include: INCLUDE_PADRAO,
      });
    });

    return this.paraResposta(lancamento);
  }

  async atualizar(id: string, dados: LancamentoFormInput): Promise<Lancamento> {
    await this.buscarPorId(id);

    const lancamento = await this.prisma.comTenant(async (tx) => {
      await this.garantirVinculosValidos(tx, dados);

      return tx.lancamentoFinanceiro.update({
        where: { id },
        data: {
          tipo: dados.tipo,
          natureza: dados.natureza,
          descricao: dados.descricao,
          valor: dados.valor,
          data: new Date(`${dados.data}T00:00:00Z`),
          categoriaId: dados.categoriaId,
          servicoId: dados.servicoId,
          clienteId: dados.clienteId,
        },
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
    await this.buscarPorId(id);

    await this.prisma.comTenant((tx) => tx.lancamentoFinanceiro.deleteMany({ where: { id } }));
  }

  // --- Relatórios ----------------------------------------------------------

  /**
   * Fluxo de caixa do período.
   *
   * Ignora lançamentos pessoais por padrão: misturá-los ao caixa da empresa
   * distorceria o custo operacional e, por consequência, toda decisão de preço.
   */
  async fluxoDeCaixa(query: PeriodoQuery): Promise<FluxoDeCaixa> {
    const where = {
      data: {
        gte: new Date(`${query.de}T00:00:00Z`),
        lte: new Date(`${query.ate}T23:59:59.999Z`),
      },
      natureza: query.natureza ?? ('empresa' as const),
    };

    const [porTipo, porTipoCusto] = await this.prisma.comTenant((tx) =>
      Promise.all([
        tx.lancamentoFinanceiro.groupBy({
          by: ['tipo'],
          where,
          _sum: { valor: true },
        }),
        // As saídas separadas por fixo e variável, para o custo operacional.
        tx.lancamentoFinanceiro.findMany({
          where: { ...where, tipo: 'saida' },
          select: { valor: true, categoria: { select: { tipoCusto: true } } },
        }),
      ]),
    );

    const entradas = porTipo.find((g) => g.tipo === 'entrada')?._sum.valor ?? ZERO;
    const saidas = porTipo.find((g) => g.tipo === 'saida')?._sum.valor ?? ZERO;

    // A soma por tipo de custo é feita com Decimal, não com números: somar
    // centenas de valores em ponto flutuante acumula erro de centavos.
    let custoFixo = ZERO;
    let custoVariavel = ZERO;

    for (const saida of porTipoCusto) {
      if (saida.categoria?.tipoCusto === 'fixo') {
        custoFixo = custoFixo.plus(saida.valor);
      } else if (saida.categoria?.tipoCusto === 'variavel') {
        custoVariavel = custoVariavel.plus(saida.valor);
      }
      // Saída sem categoria não entra em nenhum dos dois: classificá-la por
      // suposição inventaria um número.
    }

    return {
      entradas: entradas.toFixed(2),
      saidas: saidas.toFixed(2),
      saldo: entradas.minus(saidas).toFixed(2),
      custoFixo: custoFixo.toFixed(2),
      custoVariavel: custoVariavel.toFixed(2),
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
    const where = {
      data: {
        gte: new Date(`${query.de}T00:00:00Z`),
        lte: new Date(`${query.ate}T23:59:59.999Z`),
      },
      natureza: query.natureza ?? ('empresa' as const),
    };

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

  private async garantirVinculosValidos(
    tx: Parameters<Parameters<PrismaService['comTenant']>[0]>[0],
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
