import { formatarBRL, type AnalisePrevisaoFinanceira } from '@gestao/shared-types';
import {
  AssistenteIa,
  type ContextoConversa,
  type ContextoPrevisao,
  type PanoramaNegocio,
  type RespostaConversa,
  type ResultadoAssistenteIa,
} from './assistente-ia';

/**
 * Versão do conjunto de regras da análise local.
 *
 * Viaja no registro de consumo de IA, que é o que permite saber depois com
 * qual lógica cada análise foi gerada. Suba o número junto com mudanças nas
 * regras — e como a constante é usada também nos testes, ela não fica para
 * trás quando isso acontece.
 */
export const MODELO_ANALISE_LOCAL = 'analise-local-v2';

/**
 * Análise gerencial baseada em regras, sem chamadas a provedores externos.
 *
 * Deixou de ser um produto por si — o plano Básico não oferece mais previsão
 * "gratuita" com cara de IA. O que ela é hoje: a **rede de segurança** do plano
 * Premium. Quando a chamada ao fornecedor falha, é melhor devolver um resumo
 * honesto dos próprios números do que uma tela de erro.
 */
export class AssistenteDemonstracao extends AssistenteIa {
  analisarPrevisao(contexto: ContextoPrevisao): Promise<ResultadoAssistenteIa> {
    const negativos = contexto.projecoes.filter((item) => Number(item.saldoAcumulado) < 0);
    const saldos = contexto.projecoes.map((item) => Number(item.saldoAcumulado));
    const menorSaldo = saldos.length > 0 ? Math.min(...saldos) : Number(contexto.saldoAtual);
    const deficitarios = contexto.projecoes.filter((item) => Number(item.saldo) < 0);
    const ultimo = contexto.projecoes.at(-1);
    const mediaSaidas = contexto.projecoes.length
      ? contexto.projecoes.reduce((total, item) => total + Number(item.saidas), 0) /
        contexto.projecoes.length
      : 0;
    const nivelRisco: AnalisePrevisaoFinanceira['nivelRisco'] =
      negativos.length > 0
        ? 'alto'
        : deficitarios.length > 0 ||
            menorSaldo <= 0 ||
            menorSaldo < mediaSaidas ||
            menorSaldo < Number(contexto.saldoAtual) * 0.2
          ? 'moderado'
          : 'baixo';
    const primeiro = contexto.projecoes[0];
    const negocio = contexto.negocio;

    return Promise.resolve({
      modo: 'demonstracao',
      modelo: MODELO_ANALISE_LOCAL,
      inputTokens: 0,
      outputTokens: 0,
      analise: {
        resumo: negativos.length
          ? `A projeção indica saldo negativo em ${negativos.length} mês(es). O primeiro ponto crítico é ${negativos[0]?.mes}.`
          : ultimo
            ? `O saldo acumulado projetado para ${ultimo.mes} é ${formatarBRL(ultimo.saldoAcumulado)}. ${deficitarios.length ? `Há ${deficitarios.length} mês(es) com saídas maiores que entradas, consumindo o caixa disponível.` : 'Não há meses com saldo mensal negativo na projeção.'}`
            : 'Ainda não há projeções para avaliar o caixa.',
        nivelRisco,
        pontosAtencao: [
          primeiro
            ? `Em ${primeiro.mes}, há ${formatarBRL(primeiro.contasAPagarConhecidas)} a pagar e ${formatarBRL(primeiro.contasAReceberConhecidas)} a receber já registrados. Recebimentos previstos ainda precisam ser confirmados.`
            : 'Ainda não há meses suficientes para detalhar a projeção.',
          'Valores sem baixa e lançamentos futuros incompletos reduzem a precisão.',
          ...(negocio.contasVencidas.quantidade > 0
            ? [
                `Há ${negocio.contasVencidas.quantidade} conta(s) vencida(s) somando ${formatarBRL(negocio.contasVencidas.valor)}. Elas distorcem a projeção enquanto não forem baixadas ou renegociadas.`,
              ]
            : []),
          ...(ultimo
            ? [
                `O menor saldo acumulado do período é ${formatarBRL(String(menorSaldo))}. Os totais mensais não mostram eventuais faltas de caixa entre vencimentos.`,
              ]
            : []),
          ...(contexto.historico.length < 3
            ? ['Histórico curto: há menos de três meses disponíveis para comparação.']
            : []),
          ...(mediaSaidas > 0 && menorSaldo >= 0 && menorSaldo < mediaSaidas
            ? [
                'O menor saldo projetado é inferior a um mês de saídas médias projetadas; há pouca margem para atrasos de clientes.',
              ]
            : []),
        ],
        acoesRecomendadas: [
          ...(negativos.length
            ? [
                `Antes de ${negativos[0]?.mes}, revise os vencimentos no Financeiro e negocie prazos para cobrir o déficit projetado de ${formatarBRL(String(Math.abs(menorSaldo)))}.`,
              ]
            : []),
          ...(deficitarios.length
            ? [
                'Revise as categorias de despesa dos meses deficitários e identifique gastos recorrentes que podem ser ajustados.',
              ]
            : []),
          'No Financeiro, confira as baixas e os vencimentos de contas a pagar e receber antes de assumir novas despesas.',
          'Nos Orçamentos e no CRM, acompanhe propostas abertas com lembretes de retorno. Proposta aprovada não é dinheiro recebido.',
          'Em Reservas, planeje uma margem para imprevistos considerando despesas essenciais e a regularidade dos recebimentos.',
          'Registre o pró-labore separadamente e inclua as retiradas previstas no planejamento do caixa.',
          'Compare a previsão com os valores realizados a cada fechamento mensal.',
        ],
        avisos: [
          'Análise local por regras sobre os registros da empresa; não utiliza ChatGPT nem consulta bancos automaticamente.',
          'Esta é uma estimativa gerencial, não uma garantia de resultado nem aconselhamento contábil.',
        ],
        cenarios: {
          pessimista: `Se as propostas em aberto (${formatarBRL(negocio.propostasAbertas.valor)}) não fecharem e as contas vencidas não forem recebidas, o caixa do período fica abaixo de ${formatarBRL(String(menorSaldo))}.`,
          base: ultimo
            ? `Mantido o ritmo do histórico e a conversão de ${percentual(negocio.taxaConversao)}, o saldo acumulado chega a ${formatarBRL(ultimo.saldoAcumulado)}.`
            : 'Sem projeções suficientes para descrever o cenário base.',
          otimista: `Se as ${negocio.propostasAbertas.quantidade} proposta(s) em aberto fecharem acima da conversão histórica, entram até ${formatarBRL(negocio.propostasAbertas.valor)} além do projetado.`,
        },
        oportunidades: [
          ...(negocio.propostasAbertas.quantidade > 0
            ? [
                `${negocio.propostasAbertas.quantidade} proposta(s) em aberto somam ${formatarBRL(negocio.propostasAbertas.valor)}. É a receita mais perto de acontecer.`,
              ]
            : []),
          ...(negocio.agendamentosFuturos > 0
            ? [
                `${negocio.agendamentosFuturos} serviço(s) já agendado(s) para os próximos dias, ainda sem lançamento correspondente.`,
              ]
            : []),
          ...(negocio.maioresSaidas.length > 0
            ? [
                `A maior saída do período foi "${negocio.maioresSaidas[0]!.categoria}" (${formatarBRL(negocio.maioresSaidas[0]!.valor)}). Renegociar essa categoria tem o maior efeito por esforço.`,
              ]
            : []),
        ],
      },
    });
  }

  /**
   * Resposta de contingência do chat Premium.
   *
   * Não tenta imitar conversa: diz o que sabe, com os números que tem em mãos,
   * e avisa que o modelo não respondeu. Fingir naturalidade aqui só serviria
   * para esconder de quem paga que a IA não estava disponível.
   */
  conversar(contexto: ContextoConversa): Promise<RespostaConversa> {
    const panorama = contexto.panorama;

    return Promise.resolve({
      modo: 'demonstracao',
      modelo: MODELO_ANALISE_LOCAL,
      texto: [
        'O modelo de IA não respondeu agora, então segue o retrato dos seus números com o que está registrado:',
        ...resumirPanorama(panorama),
        'Tente de novo em instantes para uma resposta analisada.',
      ].join('\n\n'),
      sugestoes: sugestoesDoPanorama(panorama),
      inputTokens: 0,
      outputTokens: 0,
    });
  }
}

/** Uma frase por bloco que a pessoa pode ver. */
function resumirPanorama(panorama: PanoramaNegocio): string[] {
  const partes: string[] = [];

  if (panorama.financeiro) {
    const financeiro = panorama.financeiro;
    partes.push(
      `**Caixa do mês:** entraram ${formatarBRL(financeiro.entradasMes)} e saíram ${formatarBRL(financeiro.saidasMes)}, movimento líquido de ${formatarBRL(financeiro.saldoMes)}. Em aberto: ${formatarBRL(financeiro.aReceber)} a receber e ${formatarBRL(financeiro.aPagar)} a pagar.`,
    );
  }

  if (panorama.comercial) {
    partes.push(
      `**Comercial:** ${panorama.comercial.propostasAbertas} proposta(s) em aberto somando ${formatarBRL(panorama.comercial.valorEmAberto)}; ${formatarBRL(panorama.comercial.aprovadosNoMes)} aprovados no mês.`,
    );
  }

  if (panorama.carteira) {
    partes.push(
      `**Carteira:** ${panorama.carteira.clientes} cliente(s), ${panorama.carteira.leadsSeteDias} lead(s) nos últimos 7 dias, ${panorama.carteira.leadsAguardandoContato} aguardando contato e ${panorama.carteira.clientesParaReativar} para reativar.`,
    );
  }

  if (panorama.agenda) {
    partes.push(
      `**Agenda:** ${panorama.agenda.hoje} compromisso(s) hoje e ${panorama.agenda.proximosSeteDias} nos próximos sete dias${panorama.agenda.atrasados ? `, com ${panorama.agenda.atrasados} em atraso` : ''}.`,
    );
  }

  if (panorama.followUps) {
    partes.push(
      `**Follow-ups:** ${panorama.followUps.pendentes} pendente(s), ${panorama.followUps.atrasados} atrasado(s).`,
    );
  }

  return partes.length > 0 ? partes : ['Não há dados liberados para o seu usuário nesta consulta.'];
}

function sugestoesDoPanorama(panorama: PanoramaNegocio): string[] {
  const sugestoes: string[] = [];

  if (panorama.financeiro) sugestoes.push('Como está meu caixa este mês?');
  if (panorama.comercial) sugestoes.push('Quais propostas devo cobrar primeiro?');
  if (panorama.carteira) sugestoes.push('Quem eu deveria reativar esta semana?');

  return sugestoes.slice(0, 3);
}

function percentual(valor: number): string {
  return `${Math.round(valor * 100)}%`;
}
