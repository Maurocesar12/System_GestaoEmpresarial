import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CODIGOS_ERRO,
  type Comissao,
  type ComissoesQuery,
  type FechamentoComissao,
  type FechamentoComissaoInput,
  type MinhasComissoesQuery,
  type RelatorioComissoes,
  type ResumoComissaoPessoa,
} from '@gestao/shared-types';
import { uuidv7 } from '../../../common/uuid';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService, type TransacaoComTenant } from '../../../infra/prisma/prisma.service';
import { exigirContextoTenant, tenantAtual } from '../../../infra/tenant/tenant-context';
import { hojeEmDia } from '../../financeiro/datas';
import { AuditoriaService } from '../../plataforma/auditoria/auditoria.service';
import { diaEmSaoPaulo } from '../estoque/estoque.service';
import { calcularComissao } from './calculo-comissao';

const ZERO = new Prisma.Decimal(0);
const NOME_CATEGORIA = 'Comissões';

/** Teto de linhas da listagem. O resumo por pessoa vem do banco e não é cortado. */
const LIMITE_ITENS = 1000;

const INCLUDE_PADRAO = {
  usuario: { select: { nome: true } },
  servico: { select: { nome: true } },
  orcamento: { select: { cliente: { select: { nome: true } } } },
  agendamento: { select: { cliente: { select: { nome: true } } } },
} as const;

type ComissaoBanco = Prisma.ComissaoGetPayload<{ include: typeof INCLUDE_PADRAO }>;

const paraDataDoBanco = (dia: string) => new Date(`${dia}T00:00:00Z`);

const formatarDia = (dia: string) => dia.split('-').reverse().join('/');

@Injectable()
export class ComissoesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /** Comissão do vendedor, na aprovação do orçamento. Chamada dentro da transação da aprovação. */
  async gerarVenda(
    tx: TransacaoComTenant,
    orcamento: {
      id: string;
      vendedorId: string | null;
      servicoId: string | null;
      valor: Prisma.Decimal;
    },
  ): Promise<void> {
    if (!orcamento.vendedorId) return;

    const vendedor = await tx.usuario.findUnique({
      where: { id: orcamento.vendedorId },
      select: { comissaoVendaPercentual: true },
    });
    const percentual = vendedor?.comissaoVendaPercentual ?? null;
    const valor = calcularComissao(orcamento.valor, percentual);

    if (!valor || !percentual) return;

    await tx.comissao.create({
      data: {
        id: uuidv7(),
        tenantId: tenantAtual(),
        usuarioId: orcamento.vendedorId,
        tipo: 'venda',
        orcamentoId: orcamento.id,
        servicoId: orcamento.servicoId,
        base: orcamento.valor,
        percentual,
        valor,
        competencia: paraDataDoBanco(hojeEmDia()),
      },
    });
  }

  /**
   * Comissão do técnico, na execução do agendamento.
   *
   * A base é o valor do orçamento ligado ao agendamento; sem orçamento, o preço
   * padrão do serviço. Sem nenhum dos dois não há sobre o que calcular.
   */
  async gerarExecucao(
    tx: TransacaoComTenant,
    agendamento: {
      id: string;
      tecnicoId: string | null;
      servicoId: string | null;
      orcamentoId: string | null;
      dataHora: Date;
    },
  ): Promise<void> {
    if (!agendamento.tecnicoId) return;

    const [tecnico, orcamento, servico] = await Promise.all([
      tx.usuario.findUnique({
        where: { id: agendamento.tecnicoId },
        select: { comissaoExecucaoPercentual: true },
      }),
      agendamento.orcamentoId
        ? tx.orcamento.findUnique({
            where: { id: agendamento.orcamentoId },
            select: { valor: true },
          })
        : null,
      agendamento.servicoId
        ? tx.servico.findUnique({
            where: { id: agendamento.servicoId },
            select: { precoPadrao: true },
          })
        : null,
    ]);

    const percentual = tecnico?.comissaoExecucaoPercentual ?? null;
    const base = orcamento?.valor ?? servico?.precoPadrao ?? null;
    const valor = calcularComissao(base, percentual);

    if (!valor || !percentual || !base) return;

    await tx.comissao.create({
      data: {
        id: uuidv7(),
        tenantId: tenantAtual(),
        usuarioId: agendamento.tecnicoId,
        tipo: 'execucao',
        agendamentoId: agendamento.id,
        servicoId: agendamento.servicoId,
        base,
        percentual,
        valor,
        competencia: paraDataDoBanco(diaEmSaoPaulo(agendamento.dataHora)),
      },
    });
  }

  async listarMinhas(query: MinhasComissoesQuery): Promise<RelatorioComissoes> {
    return this.listar({ ...query, usuarioId: exigirContextoTenant().usuarioId });
  }

  async listar(query: ComissoesQuery): Promise<RelatorioComissoes> {
    const periodo: Prisma.ComissaoWhereInput = {
      competencia: { gte: paraDataDoBanco(query.de), lte: paraDataDoBanco(query.ate) },
      ...(query.usuarioId ? { usuarioId: query.usuarioId } : {}),
    };
    const where: Prisma.ComissaoWhereInput = {
      ...periodo,
      ...(query.status ? { status: query.status } : {}),
    };

    const { registros, grupos, pessoas } = await this.prisma.comTenant(async (tx) => {
      const [registros, grupos] = await Promise.all([
        tx.comissao.findMany({
          where,
          include: INCLUDE_PADRAO,
          orderBy: [{ competencia: 'desc' }, { criadoEm: 'desc' }],
          take: LIMITE_ITENS,
        }),
        tx.comissao.groupBy({
          by: ['usuarioId', 'status'],
          where: periodo,
          _sum: { valor: true },
          _count: { _all: true },
        }),
      ]);

      const ids = [...new Set(grupos.map((grupo) => grupo.usuarioId))];
      const pessoas = ids.length
        ? await tx.usuario.findMany({ where: { id: { in: ids } }, select: { id: true, nome: true } })
        : [];

      return { registros, grupos, pessoas };
    });

    const nomes = new Map(pessoas.map((pessoa) => [pessoa.id, pessoa.nome]));
    const porPessoa = new Map<
      string,
      { pendente: Prisma.Decimal; fechada: Prisma.Decimal; quantidadePendente: number }
    >();
    let totalPendente = ZERO;
    let totalFechado = ZERO;

    for (const grupo of grupos) {
      const soma = grupo._sum.valor ?? ZERO;
      const atual = porPessoa.get(grupo.usuarioId) ?? {
        pendente: ZERO,
        fechada: ZERO,
        quantidadePendente: 0,
      };

      if (grupo.status === 'pendente') {
        atual.pendente = atual.pendente.plus(soma);
        atual.quantidadePendente += grupo._count._all;
        totalPendente = totalPendente.plus(soma);
      } else {
        atual.fechada = atual.fechada.plus(soma);
        totalFechado = totalFechado.plus(soma);
      }

      porPessoa.set(grupo.usuarioId, atual);
    }

    const resumo: ResumoComissaoPessoa[] = [...porPessoa.entries()]
      .map(([usuarioId, valores]) => ({
        usuarioId,
        usuarioNome: nomes.get(usuarioId) ?? 'Pessoa removida',
        pendente: valores.pendente.toFixed(2),
        quantidadePendente: valores.quantidadePendente,
        fechada: valores.fechada.toFixed(2),
      }))
      .sort((a, b) => Number(b.pendente) - Number(a.pendente));

    return {
      itens: registros.map((registro) => this.paraResposta(registro)),
      porPessoa: resumo,
      totalPendente: totalPendente.toFixed(2),
      totalFechado: totalFechado.toFixed(2),
      periodo: { de: query.de, ate: query.ate },
    };
  }

  /**
   * Fecha as comissões pendentes de uma pessoa no período e cria a conta a pagar.
   *
   * A conta a pagar vai para a categoria "Comissões" e **não** aponta para
   * serviço: a comissão já entra na margem de cada serviço pela própria
   * comissão, e apontar a conta também contaria o custo duas vezes.
   */
  async fechar(dados: FechamentoComissaoInput): Promise<FechamentoComissao> {
    return this.prisma.comTenant(async (tx) => {
      const pessoa = await tx.usuario.findUnique({
        where: { id: dados.usuarioId },
        select: { nome: true },
      });

      if (!pessoa) {
        throw new NotFoundException({
          codigo: CODIGOS_ERRO.NAO_ENCONTRADO,
          mensagem: 'Pessoa da equipe não encontrada.',
        });
      }

      const pendentes = await tx.comissao.findMany({
        where: {
          usuarioId: dados.usuarioId,
          status: 'pendente',
          competencia: { gte: paraDataDoBanco(dados.de), lte: paraDataDoBanco(dados.ate) },
        },
        select: { id: true, valor: true },
      });

      if (pendentes.length === 0) {
        throw new BadRequestException({
          codigo: CODIGOS_ERRO.VALIDACAO,
          mensagem: `Não há comissões pendentes de ${pessoa.nome} neste período.`,
        });
      }

      const total = pendentes.reduce((soma, item) => soma.plus(item.valor), ZERO);
      const hoje = hojeEmDia();
      const categoriaId = await this.categoriaDeComissoes(tx);

      const lancamento = await tx.lancamentoFinanceiro.create({
        data: {
          id: uuidv7(),
          tenantId: tenantAtual(),
          tipo: 'saida',
          natureza: 'empresa',
          descricao: `Comissões de ${pessoa.nome} · ${formatarDia(dados.de)} a ${formatarDia(dados.ate)}`,
          valor: total,
          data: paraDataDoBanco(hoje),
          vencimento: paraDataDoBanco(dados.vencimento ?? hoje),
          categoriaId,
        },
      });

      const ids = pendentes.map((item) => item.id);
      const { count } = await tx.comissao.updateMany({
        where: { id: { in: ids }, status: 'pendente' },
        data: { status: 'fechada', lancamentoId: lancamento.id, fechadaEm: new Date() },
      });

      // Outro fechamento levou parte destas comissões entre a leitura e a
      // gravação. Desfaz tudo em vez de criar uma conta com valor errado.
      if (count !== ids.length) {
        throw new ConflictException({
          codigo: CODIGOS_ERRO.CONFLITO,
          mensagem: 'As comissões mudaram durante o fechamento. Atualize a tela e tente de novo.',
        });
      }

      await this.auditoria.registrar(tx, {
        entidade: 'comissao',
        entidadeId: lancamento.id,
        acao: 'movimentou',
        resumo: `Comissões fechadas: ${pessoa.nome} · ${ids.length} comissão(ões) · R$ ${total.toFixed(2)}`,
      });

      return { lancamentoId: lancamento.id, valor: total.toFixed(2), quantidade: ids.length };
    });
  }

  private async categoriaDeComissoes(tx: TransacaoComTenant): Promise<string> {
    const existente = await tx.categoriaFinanceira.findFirst({
      where: { nome: NOME_CATEGORIA },
      select: { id: true },
    });

    if (existente) return existente.id;

    const criada = await tx.categoriaFinanceira.create({
      data: { id: uuidv7(), tenantId: tenantAtual(), nome: NOME_CATEGORIA, tipoCusto: 'variavel' },
    });

    return criada.id;
  }

  private paraResposta(registro: ComissaoBanco): Comissao {
    return {
      id: registro.id,
      usuarioId: registro.usuarioId,
      usuarioNome: registro.usuario.nome,
      tipo: registro.tipo,
      status: registro.status,
      servicoId: registro.servicoId,
      servicoNome: registro.servico?.nome ?? null,
      clienteNome:
        registro.orcamento?.cliente.nome ?? registro.agendamento?.cliente.nome ?? null,
      orcamentoId: registro.orcamentoId,
      agendamentoId: registro.agendamentoId,
      base: registro.base.toFixed(2),
      percentual: registro.percentual.toFixed(2),
      valor: registro.valor.toFixed(2),
      competencia: registro.competencia.toISOString().slice(0, 10),
      lancamentoId: registro.lancamentoId,
      fechadaEm: registro.fechadaEm?.toISOString() ?? null,
    };
  }
}
