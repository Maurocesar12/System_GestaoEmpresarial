import type { BaseDaPrevisao } from '@gestao/shared-types';

/**
 * Retrato do negócio neutro, para os testes.
 *
 * Existe porque `ContextoPrevisao` passou a exigir o panorama comercial, e
 * repetir esse objeto em cada `it` faria os testes falarem de dados que não
 * estão testando. Quem precisa de um número específico sobrescreve só ele.
 */
export function negocioDeTeste(ajustes: Partial<BaseDaPrevisao> = {}): BaseDaPrevisao {
  return {
    mesesHistorico: 6,
    mesesProjecao: 3,
    lancamentosAnalisados: 0,
    clientesNaCarteira: 0,
    propostasAbertas: { quantidade: 0, valor: '0.00' },
    taxaConversao: 0,
    ticketMedio: '0.00',
    agendamentosFuturos: 0,
    compromissosRecorrentes: '0.00',
    contasVencidas: { quantidade: 0, valor: '0.00' },
    maioresSaidas: [],
    ...ajustes,
  };
}
