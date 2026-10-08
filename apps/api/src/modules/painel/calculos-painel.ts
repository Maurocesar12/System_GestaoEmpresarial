import {
  DIAS_PARA_ALERTA,
  formatarEspera,
  type AlertaDoPainel,
  type BlocoAgenda,
  type BlocoComercial,
  type BlocoFinanceiro,
  type BlocoFollowUps,
  type BlocoFunil,
  type BlocoLeads,
  type BlocoReativacao,
  type Permissao,
} from '@gestao/shared-types';
import { Prisma } from '../../generated/prisma/client';
import { hojeEmDia } from '../financeiro/datas';
import { inicioDoDia } from '../../common/fuso';
import { ZERO } from '../financeiro/decimal';

/**
 * Cálculos puros do painel: os momentos do dia, os alertas e o resumo da série.
 *
 * Sem banco e sem contexto — recebem números e devolvem números, o que permite
 * testá-los sozinhos e lê-los sem passar pelas consultas.
 */

export const MS_POR_DIA = 24 * 60 * 60 * 1000;

/** Dias de antecedência a partir dos quais uma proposta entra em "vencendo". */
const DIAS_PROPOSTA_VENCENDO = 7;

/** Meses do gráfico de caixa do painel. */
const MESES_DA_SERIE = 6;

/** A partir de quanto a sobra de cada real que entra deixa de ser apertada. */
const SOBRA_SAUDAVEL = 0.1;

export interface Momentos {
  agora: Date;
  inicioDeHoje: Date;
  inicioDeAmanha: Date;
  fimDeAmanha: Date;
  daquiSeteDias: Date;
  seteDiasAtras: Date;
  corteParado: Date;
  inicioDoMes: Date;
  /** Meia-noite UTC do dia de hoje em Brasília — para colunas `DATE`. */
  hojeUtc: Date;
  inicioDoMesUtc: Date;
  inicioDaSerieUtc: Date;
  limiteVencimento: Date;
  mesesDaSerie: string[];
}

/**
 * Todos os cortes de tempo do painel, calculados uma vez.
 *
 * Duas famílias de data convivem aqui, e confundi-las move números de dia:
 * colunas `DATE` (vencimento, pagamento) comparam contra meia-noite **UTC**,
 * enquanto colunas de instante (agendamento, cadastro) comparam contra o começo
 * do dia **em Brasília** — que, em UTC, é 03h. Usar o mesmo valor nos dois
 * casos faria as contas do dia sumirem das 21h à meia-noite.
 */
export function calcularMomentos(agora: Date): Momentos {
  const hoje = hojeEmDia();
  const inicioDeHoje = inicioDoDia(hoje);
  const inicioDeAmanha = new Date(inicioDeHoje.getTime() + MS_POR_DIA);
  const hojeUtc = new Date(`${hoje}T00:00:00Z`);
  const [ano, mes] = hoje.split('-').map(Number);

  const mesesDaSerie = Array.from({ length: MESES_DA_SERIE }, (_, indice) =>
    new Date(Date.UTC(ano!, mes! - MESES_DA_SERIE + indice, 1)).toISOString().slice(0, 7),
  );

  return {
    agora,
    inicioDeHoje,
    inicioDeAmanha,
    fimDeAmanha: new Date(inicioDeAmanha.getTime() + MS_POR_DIA),
    daquiSeteDias: new Date(agora.getTime() + 7 * MS_POR_DIA),
    seteDiasAtras: new Date(agora.getTime() - 7 * MS_POR_DIA),
    corteParado: new Date(agora.getTime() - DIAS_PARA_ALERTA * MS_POR_DIA),
    inicioDoMes: inicioDoDia(`${hoje.slice(0, 7)}-01`),
    hojeUtc,
    inicioDoMesUtc: new Date(`${hoje.slice(0, 7)}-01T00:00:00Z`),
    inicioDaSerieUtc: new Date(Date.UTC(ano!, mes! - MESES_DA_SERIE, 1)),
    limiteVencimento: new Date(hojeUtc.getTime() + DIAS_PROPOSTA_VENCENDO * MS_POR_DIA),
    mesesDaSerie,
  };
}

/**
 * Quais entidades do histórico cada pessoa pode ver no feed.
 *
 * O mapa é explícito, e não derivado por prefixo do nome da entidade: um
 * `startsWith` acertaria hoje e erraria no dia em que alguém criar uma entidade
 * cujo nome não combina com a permissão que a protege — e o erro seria mostrar
 * dado demais, silenciosamente.
 */
export function entidadesVisiveis(permissoes: Permissao[]): string[] {
  const porPermissao: Array<[Permissao, string[]]> = [
    ['clientes.visualizar', ['cliente', 'atendimentos']],
    ['funil.visualizar', ['funil']],
    ['orcamentos.visualizar', ['orcamentos']],
    ['agenda.visualizar', ['agendamentos']],
    ['lembretes.visualizar', ['lembretes']],
    ['servicos.visualizar', ['servicos']],
    [
      'financeiro.visualizar',
      [
        'lancamento',
        'categoria',
        'pro_labore',
        'reserva',
        'previsao_financeira',
        'importacao_financeira',
      ],
    ],
    ['auditoria.visualizar', ['empresa', 'funcionario', 'convite', 'configuracoes', 'auditoria']],
  ];

  return porPermissao
    .filter(([permissao]) => permissoes.includes(permissao))
    .flatMap(([, entidades]) => entidades);
}

/**
 * Os alertas do topo.
 *
 * Ficam no servidor porque são regra de negócio: o corte que decide o que é
 * urgente precisa ser o mesmo para todo mundo, e a tela não deveria
 * reimplementá-lo para pintar um cartão. Vêm ordenados por gravidade — quem
 * abre o painel lê de cima para baixo e para quando resolve.
 */
export function montarAlertas(dados: {
  leads: BlocoLeads | null;
  funil: BlocoFunil | null;
  comercial: BlocoComercial | null;
  agenda: BlocoAgenda | null;
  followUps: BlocoFollowUps | null;
  reativacao: BlocoReativacao | null;
  financeiro: BlocoFinanceiro | null;
}): AlertaDoPainel[] {
  const alertas: AlertaDoPainel[] = [];

  if (dados.leads && dados.leads.semContatoNoPrazo > 0) {
    alertas.push({
      id: 'leads-sem-contato',
      tom: 'perigo',
      titulo: `${dados.leads.semContatoNoPrazo} lead(s) sem contato`,
      detalhe: 'Chegaram há mais de um dia e ninguém falou com eles.',
      // Âncora na própria tela: leads e reativação são cartões do painel, e não
      // telas à parte. Mandar para outra página o que está dois blocos abaixo
      // seria fazer a pessoa sair de onde a informação já estava.
      href: '#leads',
    });
  }

  if (dados.financeiro && dados.financeiro.vencidosAPagar.quantidade > 0) {
    alertas.push({
      id: 'contas-vencidas',
      tom: 'perigo',
      titulo: `${dados.financeiro.vencidosAPagar.quantidade} conta(s) vencida(s)`,
      detalhe: 'Contas a pagar em aberto com vencimento no passado.',
      href: '/painel/financeiro',
    });
  }

  if (dados.agenda && dados.agenda.atrasados > 0) {
    alertas.push({
      id: 'agenda-atrasada',
      tom: 'atencao',
      titulo: `${dados.agenda.atrasados} compromisso(s) em atraso`,
      detalhe: 'Passaram da hora e continuam como agendados ou confirmados.',
      href: '/painel/agenda',
    });
  }

  if (dados.followUps && dados.followUps.atrasados > 0) {
    alertas.push({
      id: 'followups-atrasados',
      tom: 'atencao',
      titulo: `${dados.followUps.atrasados} follow-up(s) atrasado(s)`,
      detalhe: 'A data de envio já passou e o lembrete continua pendente.',
      href: '/painel/lembretes',
    });
  }

  if (dados.comercial && dados.comercial.vencendo.length > 0) {
    const vencidas = dados.comercial.vencendo.filter((item) => item.diasRestantes < 0).length;

    alertas.push({
      id: 'propostas-vencendo',
      tom: vencidas > 0 ? 'atencao' : 'info',
      titulo:
        vencidas > 0
          ? `${vencidas} proposta(s) com validade vencida`
          : `${dados.comercial.vencendo.length} proposta(s) vencendo`,
      detalhe: 'Propostas em aberto perto do prazo de validade.',
      href: '/painel/orcamentos?status=aberto',
    });
  }

  if (dados.funil && dados.funil.paradas.length > 0) {
    const mais = dados.funil.paradas[0]!;

    alertas.push({
      id: 'funil-parado',
      tom: 'info',
      titulo: `${dados.funil.paradas.length} negociação(ões) parada(s)`,
      detalhe: `A mais antiga está em "${mais.etapa}" ${formatarEspera(mais.dias * 24)}.`,
      href: '/painel/funil',
    });
  }

  if (dados.reativacao && dados.reativacao.total > 0) {
    alertas.push({
      id: 'reativacao',
      tom: 'info',
      titulo: `${dados.reativacao.total} cliente(s) para reativar`,
      detalhe: 'Sem nenhum contato há tempo demais. A venda mais barata é a de quem já comprou.',
      href: '#reativacao',
    });
  }

  return alertas;
}

export function valorDoTipo(
  grupos: Array<{ tipo: 'entrada' | 'saida'; _sum: { valor: Prisma.Decimal | null } }>,
  tipo: 'entrada' | 'saida',
): Prisma.Decimal {
  return grupos.find((grupo) => grupo.tipo === tipo)?._sum.valor ?? ZERO;
}

/**
 * A série do gráfico e as conclusões que a tela mostra embaixo dele.
 *
 * Moravam no componente do gráfico, somadas em `Number`. As leituras — melhor
 * mês, meses no vermelho, quanto sobra de cada real — são de negócio, e a
 * regra de usar só os meses fechados (o corrente está pela metade e seria o
 * "pior mês" todo dia 2) agora está num lugar só.
 */
export function resumirSerie(
  porMes: Map<string, { entradas: Prisma.Decimal; saidas: Prisma.Decimal }>,
): Pick<BlocoFinanceiro, 'serie' | 'resumoSerie'> {
  let acumulado = ZERO;
  const meses = [...porMes.entries()].map(([mes, valores]) => {
    const saldo = valores.entradas.minus(valores.saidas);
    acumulado = acumulado.plus(saldo);
    return { mes, entradas: valores.entradas, saidas: valores.saidas, saldo, acumulado };
  });

  const totalEntradas = meses.reduce((soma, mes) => soma.plus(mes.entradas), ZERO);
  const totalSaidas = meses.reduce((soma, mes) => soma.plus(mes.saidas), ZERO);
  const saldoDoPeriodo = totalEntradas.minus(totalSaidas);

  // Quanto sobra de cada real que entra. Abaixo de 10% é margem apertada.
  const sobra = totalEntradas.isZero()
    ? 0
    : Number(saldoDoPeriodo.dividedBy(totalEntradas).toFixed(4));

  const fechados = meses.slice(0, -1);
  const base = fechados.length > 0 ? fechados : meses;
  const melhor = base.reduce<(typeof meses)[number] | null>(
    (maior, mes) => (maior === null || mes.saldo.greaterThan(maior.saldo) ? mes : maior),
    null,
  );

  return {
    serie: meses.map((mes, indice) => {
      const anterior = meses[indice - 1];
      return {
        mes: mes.mes,
        entradas: mes.entradas.toFixed(2),
        saidas: mes.saidas.toFixed(2),
        saldo: mes.saldo.toFixed(2),
        acumulado: mes.acumulado.toFixed(2),
        variacaoSaldo: anterior ? mes.saldo.minus(anterior.saldo).toFixed(2) : null,
      };
    }),
    resumoSerie: {
      totalEntradas: totalEntradas.toFixed(2),
      totalSaidas: totalSaidas.toFixed(2),
      saldoDoPeriodo: saldoDoPeriodo.toFixed(2),
      temMovimento: meses.some((mes) => !mes.entradas.isZero() || !mes.saidas.isZero()),
      melhorMes: melhor
        ? { mes: melhor.mes, saldo: melhor.saldo.toFixed(2), emAndamento: fechados.length === 0 }
        : null,
      mesesNegativos: base.filter((mes) => mes.saldo.isNegative()).length,
      mesesComparados: base.length,
      sobraPorReal: sobra,
      faixaSobra: sobra < 0 ? 'negativa' : sobra < SOBRA_SAUDAVEL ? 'baixa' : 'saudavel',
    },
  };
}
