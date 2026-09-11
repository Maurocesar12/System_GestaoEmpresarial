import type { StatusTenant } from '../enums';

/**
 * A regra de acesso por pagamento (arquitetura §1).
 *
 * ## A regra em uma frase
 *
 * Cada pagamento compra **um mês** de acesso, contado a partir do dia em que
 * ele foi confirmado. Antes do primeiro pagamento vale o período de teste.
 * Passou da data e não houve pagamento novo, o acesso fecha.
 *
 * ## Por que a conta vive aqui, e não no login
 *
 * Três lugares precisam da mesma resposta: a API, para barrar a entrada; a
 * tela, para avisar com antecedência; e o teste, para provar que as duas
 * concordam. Uma cópia da regra em cada um deles é uma cópia que um dia
 * diverge — e divergir aqui significa ou barrar quem pagou, ou liberar quem
 * não pagou.
 *
 * ## Sobre o fuso
 *
 * O vencimento é comparado por **dia**, não por instante. Quem pagou dia 10 às
 * 23h tem acesso até o fim do dia 10 do mês seguinte, e não até as 23h — o
 * relógio não deveria decidir isso por alguém que já pagou.
 */

/** Quantos dias antes do vencimento a tela começa a avisar. */
export const DIAS_AVISO_PAGAMENTO = 7;

export type MotivoAcesso =
  /** Dentro do período de teste. */
  | 'trial'
  /** Dentro do mês pago. */
  | 'pago'
  /** Teste acabou e nunca houve pagamento. */
  | 'sem_pagamento'
  /** O mês pago venceu. */
  | 'vencido'
  /** Conta encerrada pelo próprio cliente ou pelo suporte. */
  | 'cancelado';

export interface SituacaoDeAcesso {
  liberado: boolean;
  motivo: MotivoAcesso;
  /** Último dia de acesso, `AAAA-MM-DD`. `null` quando não há prazo a mostrar. */
  acessoAte: string | null;
  /**
   * Dias inteiros até o vencimento. Zero é "vence hoje" e negativo é atraso.
   * `null` quando não há prazo.
   */
  diasRestantes: number | null;
}

export interface DadosDeAcesso {
  status: StatusTenant;
  /** Fim do período de teste, `AAAA-MM-DD` ou ISO completo. */
  trialTerminaEm?: string | null;
  /** Quando o último pagamento foi confirmado. */
  ultimoPagamentoEm?: string | null;
}

const DIA_MS = 24 * 60 * 60 * 1000;

/** Só a parte da data, em UTC — é o que torna a comparação por dia possível. */
function apenasODia(valor: string | Date): number {
  const data = typeof valor === 'string' ? new Date(valor) : valor;

  return Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate());
}

function formatarDia(epoch: number): string {
  return new Date(epoch).toISOString().slice(0, 10);
}

/**
 * Soma um mês de calendário, prendendo no último dia quando o mês é curto.
 *
 * Pagamento em 31 de janeiro vence em 28 de fevereiro, não em 3 de março — a
 * soma ingênua de 30 dias daria ao cliente dias a mais em alguns meses e a
 * menos em outros, e a fatura seguinte nunca bateria com a anterior.
 */
export function somarUmMes(epoch: number): number {
  const data = new Date(epoch);
  const ano = data.getUTCFullYear();
  const mes = data.getUTCMonth();
  const dia = data.getUTCDate();

  // Dia 0 do mês seguinte ao alvo é o último dia do mês alvo.
  const ultimoDiaDoMesAlvo = new Date(Date.UTC(ano, mes + 2, 0)).getUTCDate();

  return Date.UTC(ano, mes + 1, Math.min(dia, ultimoDiaDoMesAlvo));
}

/**
 * Decide se a empresa pode entrar, e até quando.
 *
 * @param hoje Injetável para o teste não depender do relógio da máquina.
 */
export function calcularAcesso(dados: DadosDeAcesso, hoje: Date = new Date()): SituacaoDeAcesso {
  const diaDeHoje = apenasODia(hoje);

  if (dados.status === 'cancelado') {
    return { liberado: false, motivo: 'cancelado', acessoAte: null, diasRestantes: null };
  }

  // O pagamento manda sobre o teste: quem pagou no meio do trial não deve
  // perder acesso quando o trial terminar.
  const limite = dados.ultimoPagamentoEm
    ? somarUmMes(apenasODia(dados.ultimoPagamentoEm))
    : dados.trialTerminaEm
      ? apenasODia(dados.trialTerminaEm)
      : null;

  if (limite === null) {
    // Sem teste e sem pagamento: não há o que liberar nem data a mostrar.
    return { liberado: false, motivo: 'sem_pagamento', acessoAte: null, diasRestantes: null };
  }

  const diasRestantes = Math.round((limite - diaDeHoje) / DIA_MS);
  const dentroDoPrazo = diasRestantes >= 0;
  const pagou = Boolean(dados.ultimoPagamentoEm);

  return {
    liberado: dentroDoPrazo,
    motivo: dentroDoPrazo ? (pagou ? 'pago' : 'trial') : pagou ? 'vencido' : 'sem_pagamento',
    acessoAte: formatarDia(limite),
    diasRestantes,
  };
}

/** A frase que o usuário lê — a mesma no bloqueio da API e no aviso da tela. */
export function mensagemDeAcesso(situacao: SituacaoDeAcesso): string {
  const data = situacao.acessoAte
    ? new Date(`${situacao.acessoAte}T00:00:00Z`).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
    : null;

  switch (situacao.motivo) {
    case 'cancelado':
      return 'Esta conta foi cancelada.';

    case 'vencido':
      return `Seu acesso venceu em ${data}. Realize o pagamento para voltar a usar o sistema.`;

    case 'sem_pagamento':
      return data
        ? `Seu período de teste terminou em ${data}. Realize o pagamento para continuar usando o sistema.`
        : 'É preciso realizar o pagamento para acessar o sistema.';

    case 'trial':
      return `Seu período de teste vai até ${data}. Realize o pagamento até lá para não perder o acesso.`;

    case 'pago':
      return `Seu acesso está garantido até ${data}. Realize o pagamento até essa data para continuar.`;
  }
}
