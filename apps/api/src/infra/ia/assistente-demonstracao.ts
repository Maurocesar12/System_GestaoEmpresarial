import type { AnalisePrevisaoFinanceira } from '@gestao/shared-types';
import { AssistenteIa, type ContextoPrevisao, type ResultadoAssistenteIa } from './assistente-ia';

/** Análise local para desenvolver e demonstrar o produto sem chave ou custo. */
export class AssistenteDemonstracao extends AssistenteIa {
  analisarPrevisao(contexto: ContextoPrevisao): Promise<ResultadoAssistenteIa> {
    const negativos = contexto.projecoes.filter((item) => Number(item.saldoAcumulado) < 0);
    const saldos = contexto.projecoes.map((item) => Number(item.saldoAcumulado));
    const menorSaldo = saldos.length > 0 ? Math.min(...saldos) : Number(contexto.saldoAtual);
    const nivelRisco: AnalisePrevisaoFinanceira['nivelRisco'] =
      negativos.length > 0
        ? 'alto'
        : menorSaldo < Number(contexto.saldoAtual) * 0.2
          ? 'moderado'
          : 'baixo';
    const primeiro = contexto.projecoes[0];

    return Promise.resolve({
      modo: 'demonstracao',
      modelo: 'analise-local-v1',
      inputTokens: 0,
      outputTokens: 0,
      analise: {
        resumo: negativos.length
          ? `A projeção indica saldo negativo em ${negativos.length} mês(es). O primeiro ponto crítico é ${negativos[0]?.mes}.`
          : 'A projeção não indica saldo negativo, mas deve ser revisada sempre que novas contas forem registradas.',
        nivelRisco,
        pontosAtencao: [
          primeiro
            ? `No primeiro mês projetado há ${primeiro.contasAPagarConhecidas} em contas a pagar já conhecidas.`
            : 'Ainda não há meses suficientes para detalhar a projeção.',
          'Valores sem baixa e lançamentos futuros incompletos reduzem a precisão.',
        ],
        acoesRecomendadas: negativos.length
          ? [
              'Antecipar recebimentos previstos.',
              'Revisar ou adiar despesas não essenciais antes do mês crítico.',
            ]
          : [
              'Manter as contas a pagar e receber atualizadas.',
              'Comparar a previsão com o realizado no fim de cada mês.',
            ],
        avisos: [
          'Esta é uma estimativa gerencial, não uma garantia de resultado nem aconselhamento contábil.',
        ],
      },
    });
  }
}
