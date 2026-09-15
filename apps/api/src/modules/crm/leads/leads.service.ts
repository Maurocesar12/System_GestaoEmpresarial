import { Injectable } from '@nestjs/common';
import {
  HORAS_LEAD_SEM_CONTATO,
  LIMITE_ANALISE_REATIVACAO,
  paginar,
  type ClienteParaReativar,
  type EntradaDeLeads,
  type Lead,
  type LeadsQuery,
  type ListaDeReativacao,
  type MotivoReativacao,
  type ReativacaoQuery,
  type ResumoLeads,
} from '@gestao/shared-types';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService, type TransacaoComTenant } from '../../../infra/prisma/prisma.service';
import {
  filtroDeFrios,
  filtroDeLeads,
  maisAntigo,
  maisRecente,
  motivoDoFrio,
  situacaoDoLead,
  MS_POR_DIA,
  MS_POR_HORA,
  SEM_NENHUM_CONTATO,
  CLIENTE_ATIVO,
} from './regras-leads';

/**
 * Relação de entrada (leads que chegaram) e de saída (clientes que esfriaram).
 *
 * As duas listas são **leituras derivadas**: nenhuma tabela nova, nenhum campo
 * que alguém precise manter em dia. Um lead é um cliente recém-cadastrado; um
 * candidato à reativação é um cliente sem nenhum toque há tempo demais. Manter
 * isso como consulta, e não como status gravado, é o que garante que a lista
 * nunca envelheça: no dia em que alguém registra um atendimento, o cliente sai
 * da fila sozinho.
 *
 * Os métodos que recebem `tx` são públicos de propósito — o painel em tempo
 * real os chama de dentro da **própria** transação, para que o número que ele
 * mostra e a lista que a tela abre venham do mesmo instante do banco.
 */
@Injectable()
export class LeadsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fila de entrada: quem chegou na janela pedida, do mais recente ao mais
   * antigo, com o resumo que o cabeçalho da tela usa.
   *
   * A paginação acontece no banco. O que sobe para a memória é uma página de
   * clientes com os relacionamentos que decidem a situação de cada um, e não a
   * carteira inteira.
   */
  async entrada(query: LeadsQuery): Promise<EntradaDeLeads> {
    const agora = new Date();
    const desde = new Date(agora.getTime() - query.dias * MS_POR_DIA);
    const where = filtroDeLeads(desde, query);

    const dados = await this.prisma.comTenant(async (tx) => {
      const [registros, total, resumo] = await Promise.all([
        tx.cliente.findMany({
          where,
          orderBy: { criadoEm: 'desc' },
          skip: (query.pagina - 1) * query.porPagina,
          take: query.porPagina,
          include: INCLUDE_DO_LEAD,
        }),
        tx.cliente.count({ where }),
        this.resumirEntrada(tx, agora, query.dias),
      ]);

      return { registros, total, resumo };
    });

    const leads = dados.registros.map((registro) => paraLead(registro, agora));

    return { resumo: dados.resumo, leads, meta: paginar(leads, dados.total, query).meta };
  }

  /** Fila de reativação completa, como a tela dedicada a mostra. */
  async reativacao(query: ReativacaoQuery): Promise<ListaDeReativacao> {
    const agora = new Date();
    const corte = new Date(agora.getTime() - query.dias * MS_POR_DIA);

    const { total, clientes } = await this.prisma.comTenant((tx) =>
      this.ranquearFrios(tx, {
        corte,
        agora,
        limite: LIMITE_ANALISE_REATIVACAO,
        origem: query.origem,
      }),
    );

    const ranqueados = query.motivo
      ? clientes.filter((cliente) => cliente.motivo === query.motivo)
      : clientes;

    const inicio = (query.pagina - 1) * query.porPagina;
    const pagina = ranqueados.slice(inicio, inicio + query.porPagina);

    return {
      resumo: {
        dias: query.dias,
        // Com filtro de motivo, o total do banco deixaria de corresponder ao que
        // a tela lista: o motivo só se conhece depois de somar o histórico.
        total: query.motivo ? ranqueados.length : total,
        analisados: ranqueados.length,
        valorHistorico: somar(ranqueados.map((cliente) => cliente.valorHistorico)).toFixed(2),
        porMotivo: contarMotivos(ranqueados),
      },
      clientes: pagina,
      meta: paginar(pagina, ranqueados.length, query).meta,
    };
  }

  /**
   * Clientes frios ranqueados por quanto já deram de retorno e há quanto tempo
   * sumiram.
   *
   * ## Por que o ranqueamento acontece em memória
   *
   * "Quem vale mais a pena ligar?" depende de somar os orçamentos aprovados de
   * cada candidato — um agregado por cliente que o banco só ordenaria com uma
   * consulta mais cara que a tela inteira. Em troca, a consulta traz no máximo
   * `limite` candidatos, os parados há mais tempo, e ordena esses.
   *
   * A escolha só é defensável porque esta lista é **fila de trabalho**: ninguém
   * vai ligar para mil clientes nesta semana. O total real continua vindo do
   * banco, para nenhuma tela dar a entender que os analisados são todos os que
   * existem.
   */
  async ranquearFrios(
    tx: TransacaoComTenant,
    opcoes: { corte: Date; agora: Date; limite: number; origem?: string },
  ): Promise<{ total: number; clientes: ClienteParaReativar[] }> {
    const where = filtroDeFrios(opcoes.corte, opcoes.origem);

    const [candidatos, total] = await Promise.all([
      tx.cliente.findMany({
        where,
        // Os mais antigos primeiro: são eles os parados há mais tempo, o corte
        // que menos deixa oportunidade de fora quando a carteira é grande.
        orderBy: { criadoEm: 'asc' },
        take: opcoes.limite,
        include: INCLUDE_DO_FRIO,
      }),
      tx.cliente.count({ where }),
    ]);

    const ids = candidatos.map((cliente) => cliente.id);

    // Uma consulta para o histórico aprovado de todos os candidatos. Por
    // cliente seriam trezentas idas ao banco para montar uma tela.
    const fechados =
      ids.length === 0
        ? []
        : await tx.orcamento.groupBy({
            by: ['clienteId'],
            where: { clienteId: { in: ids }, status: 'aprovado' },
            _sum: { valor: true },
            _count: { _all: true },
          });

    const historico = new Map(
      fechados.map((grupo) => [
        grupo.clienteId,
        { valor: grupo._sum.valor ?? ZERO, quantidade: grupo._count._all },
      ]),
    );

    const clientes = candidatos
      .map((candidato) => paraClienteFrio(candidato, historico, opcoes.agora))
      .sort(
        (a, b) =>
          Number(b.valorHistorico) - Number(a.valorHistorico) ||
          b.diasSemContato - a.diasSemContato,
      );

    return { total, clientes };
  }

  /**
   * Contagens da fila de entrada.
   *
   * Recebe `tx` para poder ser chamado tanto pela tela de leads quanto pelo
   * painel sem abrir uma segunda transação — dois `count` do mesmo número lidos
   * com segundos de diferença é como um painel passa a discordar de si mesmo.
   */
  async resumirEntrada(tx: TransacaoComTenant, agora: Date, dias: number): Promise<ResumoLeads> {
    const desde = new Date(agora.getTime() - dias * MS_POR_DIA);
    const inicioHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
    const inicioOntem = new Date(inicioHoje.getTime() - MS_POR_DIA);
    const inicioSemana = new Date(agora.getTime() - 7 * MS_POR_DIA);
    const prazo = new Date(agora.getTime() - HORAS_LEAD_SEM_CONTATO * MS_POR_HORA);

    const aguardando = { ...CLIENTE_ATIVO, criadoEm: { gte: desde }, ...SEM_NENHUM_CONTATO };

    const [
      hoje,
      ontem,
      semana,
      noPeriodo,
      semContato,
      atrasados,
      comProposta,
      ganhos,
      propostas,
      origens,
    ] = await Promise.all([
      tx.cliente.count({ where: { ...CLIENTE_ATIVO, criadoEm: { gte: inicioHoje } } }),
      tx.cliente.count({
        where: { ...CLIENTE_ATIVO, criadoEm: { gte: inicioOntem, lt: inicioHoje } },
      }),
      tx.cliente.count({ where: { ...CLIENTE_ATIVO, criadoEm: { gte: inicioSemana } } }),
      tx.cliente.count({ where: { ...CLIENTE_ATIVO, criadoEm: { gte: desde } } }),
      tx.cliente.count({ where: aguardando }),
      tx.cliente.count({ where: { ...aguardando, criadoEm: { gte: desde, lt: prazo } } }),
      tx.cliente.count({
        where: {
          ...CLIENTE_ATIVO,
          criadoEm: { gte: desde },
          orcamentos: { some: { status: 'aberto' } },
        },
      }),
      tx.cliente.count({
        where: {
          ...CLIENTE_ATIVO,
          criadoEm: { gte: desde },
          orcamentos: { some: { status: 'aprovado' } },
        },
      }),
      tx.orcamento.aggregate({
        where: { status: 'aberto', cliente: { ...CLIENTE_ATIVO, criadoEm: { gte: desde } } },
        _sum: { valor: true },
      }),
      tx.cliente.groupBy({
        by: ['origem'],
        where: { ...CLIENTE_ATIVO, criadoEm: { gte: desde } },
        _count: { _all: true },
        orderBy: { _count: { id: 'desc' } },
        take: 8,
      }),
    ]);

    return {
      dias,
      hoje,
      ontem,
      seteDias: semana,
      noPeriodo,
      aguardandoContato: semContato,
      semContatoNoPrazo: atrasados,
      comProposta,
      ganhos,
      valorEmProposta: (propostas._sum.valor ?? ZERO).toFixed(2),
      taxaConversao: noPeriodo === 0 ? 0 : ganhos / noPeriodo,
      porOrigem: origens.map((grupo) => ({
        origem: grupo.origem ?? 'Sem origem',
        total: grupo._count._all,
      })),
    };
  }

  /** Os leads mais recentes, para o bloco de entrada do painel. */
  async ultimosLeads(
    tx: TransacaoComTenant,
    agora: Date,
    dias: number,
    quantidade: number,
  ): Promise<Lead[]> {
    const desde = new Date(agora.getTime() - dias * MS_POR_DIA);

    const registros = await tx.cliente.findMany({
      where: filtroDeLeads(desde),
      orderBy: { criadoEm: 'desc' },
      take: quantidade,
      include: INCLUDE_DO_LEAD,
    });

    return registros.map((registro) => paraLead(registro, agora));
  }
}

const ZERO = new Prisma.Decimal(0);

/**
 * O mínimo para decidir a situação de um lead.
 *
 * Atendimento e agendamento vêm com `take: 1` ascendente porque só interessa o
 * **primeiro** — o instante em que alguém encostou no lead. Os orçamentos vêm
 * inteiros e do mais antigo ao mais recente: um lead tem dias de vida, não
 * histórico, e um teto pequeno esconderia a proposta justamente no caso em que
 * a fila mais importa.
 */
const INCLUDE_DO_LEAD = {
  posicaoFunil: { select: { etapa: { select: { id: true, nome: true } } } },
  etiquetas: { select: { etiqueta: { select: { id: true, nome: true, cor: true } } } },
  atendimentos: { select: { criadoEm: true }, orderBy: { criadoEm: 'asc' }, take: 1 },
  agendamentos: { select: { criadoEm: true }, orderBy: { criadoEm: 'asc' }, take: 1 },
  orcamentos: {
    select: { id: true, valor: true, status: true, criadoEm: true },
    orderBy: { criadoEm: 'asc' },
  },
  lembretes: {
    where: { status: 'pendente' },
    select: { dataEnvio: true },
    orderBy: { dataEnvio: 'asc' },
    take: 1,
  },
} satisfies Prisma.ClienteInclude;

const INCLUDE_DO_FRIO = {
  posicaoFunil: { select: { etapa: { select: { id: true, nome: true } } } },
  atendimentos: { select: { data: true }, orderBy: { data: 'desc' }, take: 1 },
  agendamentos: { select: { dataHora: true }, orderBy: { dataHora: 'desc' }, take: 1 },
  orcamentos: {
    select: {
      id: true,
      valor: true,
      status: true,
      criadoEm: true,
      servico: { select: { nome: true } },
    },
    orderBy: { criadoEm: 'desc' },
    take: 1,
  },
} satisfies Prisma.ClienteInclude;

type ClienteComRelacoes = Prisma.ClienteGetPayload<{ include: typeof INCLUDE_DO_LEAD }>;
type ClienteFrioComRelacoes = Prisma.ClienteGetPayload<{ include: typeof INCLUDE_DO_FRIO }>;

function paraLead(registro: ClienteComRelacoes, agora: Date): Lead {
  // Qualquer sinal de trabalho humano conta como contato: atendimento
  // registrado, visita marcada ou proposta emitida. O mais antigo dos três é o
  // instante em que o lead deixou de estar sozinho na fila.
  const primeiroContato = maisAntigo([
    registro.atendimentos[0]?.criadoEm,
    registro.agendamentos[0]?.criadoEm,
    registro.orcamentos[0]?.criadoEm,
  ]);

  // Os orçamentos vêm do mais antigo ao mais recente; a proposta que vale é a
  // última que continua aberta.
  const orcamentoAberto = registro.orcamentos.findLast((item) => item.status === 'aberto') ?? null;

  return {
    id: registro.id,
    nome: registro.nome,
    telefone: registro.telefone,
    email: registro.email,
    origem: registro.origem,
    utmSource: registro.utmSource,
    utmMedium: registro.utmMedium,
    utmCampaign: registro.utmCampaign,
    criadoEm: registro.criadoEm.toISOString(),
    situacao: situacaoDoLead(registro.orcamentos, primeiroContato !== null),
    etapaFunil: registro.posicaoFunil
      ? { id: registro.posicaoFunil.etapa.id, nome: registro.posicaoFunil.etapa.nome }
      : null,
    etiquetas: registro.etiquetas.map((item) => item.etiqueta),
    primeiroContatoEm: primeiroContato?.toISOString() ?? null,
    horasAteContato: Math.max(
      0,
      Math.floor(
        ((primeiroContato ?? agora).getTime() - registro.criadoEm.getTime()) / MS_POR_HORA,
      ),
    ),
    orcamentoAberto: orcamentoAberto
      ? { id: orcamentoAberto.id, valor: orcamentoAberto.valor.toFixed(2) }
      : null,
    lembretePendenteEm: registro.lembretes[0]?.dataEnvio.toISOString() ?? null,
  };
}

function paraClienteFrio(
  registro: ClienteFrioComRelacoes,
  historico: Map<string, { valor: Prisma.Decimal; quantidade: number }>,
  agora: Date,
): ClienteParaReativar {
  const fechado = historico.get(registro.id);
  const ultimoOrcamento = registro.orcamentos[0] ?? null;

  // O toque mais recente de qualquer natureza — o relógio do esfriamento.
  const ultimoContato = maisRecente([
    registro.atendimentos[0]?.data,
    registro.agendamentos[0]?.dataHora,
    ultimoOrcamento?.criadoEm,
  ]);

  return {
    id: registro.id,
    nome: registro.nome,
    telefone: registro.telefone,
    email: registro.email,
    origem: registro.origem,
    motivo: motivoDoFrio(ultimoOrcamento?.status, fechado?.quantidade ?? 0),
    ultimoContatoEm: ultimoContato?.toISOString() ?? null,
    // Sem nenhum toque, o relógio conta desde o cadastro: é quando a empresa
    // soube desse cliente pela primeira vez.
    diasSemContato: Math.floor(
      (agora.getTime() - (ultimoContato ?? registro.criadoEm).getTime()) / MS_POR_DIA,
    ),
    valorHistorico: (fechado?.valor ?? ZERO).toFixed(2),
    servicosFechados: fechado?.quantidade ?? 0,
    ultimoOrcamento: ultimoOrcamento
      ? {
          id: ultimoOrcamento.id,
          valor: ultimoOrcamento.valor.toFixed(2),
          status: ultimoOrcamento.status,
          criadoEm: ultimoOrcamento.criadoEm.toISOString(),
          servicoNome: ultimoOrcamento.servico?.nome ?? null,
        }
      : null,
    etapaFunil: registro.posicaoFunil
      ? { id: registro.posicaoFunil.etapa.id, nome: registro.posicaoFunil.etapa.nome }
      : null,
  };
}

/**
 * Quantos frios por motivo, do mais comum ao menos.
 *
 * Exportado porque o cartão de reativação do painel mostra a mesma quebra —
 * contar de novo lá abriria espaço para os dois números discordarem.
 */
export function contarMotivos(
  clientes: ClienteParaReativar[],
): Array<{ motivo: MotivoReativacao; total: number }> {
  const contagem = new Map<MotivoReativacao, number>();

  for (const cliente of clientes) {
    contagem.set(cliente.motivo, (contagem.get(cliente.motivo) ?? 0) + 1);
  }

  return [...contagem.entries()]
    .map(([motivo, total]) => ({ motivo, total }))
    .sort((a, b) => b.total - a.total);
}

function somar(valores: string[]): Prisma.Decimal {
  return valores.reduce((total, valor) => total.plus(valor), ZERO);
}
