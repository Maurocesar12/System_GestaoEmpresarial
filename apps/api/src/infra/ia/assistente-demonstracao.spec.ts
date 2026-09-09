import { AssistenteDemonstracao } from './assistente-demonstracao';

describe('AssistenteDemonstracao', () => {
  const assistente = new AssistenteDemonstracao();

  it('não classifica caixa zerado e sem projeções como risco baixo', async () => {
    const resultado = await assistente.analisarPrevisao({
      identificadorSeguro: 'teste', saldoAtual: '0.00', historico: [], projecoes: [],
    });
    expect(resultado.analise.nivelRisco).toBe('moderado');
    expect(resultado.analise.resumo).toContain('Ainda não há projeções');
    expect(resultado.analise.pontosAtencao.join(' ')).toContain('Histórico curto');
  });

  it('alerta sobre consumo de caixa mesmo com saldo acumulado positivo', async () => {
    const resultado = await assistente.analisarPrevisao({
      identificadorSeguro: 'teste', saldoAtual: '5000.00', historico: [],
      projecoes: [{ mes: '2026-10', entradas: '100.00', saidas: '300.00', saldo: '-200.00',
        saldoAcumulado: '4800.00', contasAReceberConhecidas: '100.00', contasAPagarConhecidas: '300.00' }],
    });
    expect(resultado.analise.nivelRisco).toBe('moderado');
    expect(resultado.analise.resumo).toContain('consumindo o caixa');
    expect(resultado.analise.acoesRecomendadas.join(' ')).toContain('categorias');
  });

  it('indica risco alto quando a projeção entra no negativo', async () => {
    const resultado = await assistente.analisarPrevisao({
      identificadorSeguro: 'teste',
      saldoAtual: '100.00',
      historico: [],
      projecoes: [
        {
          mes: '2026-10',
          entradas: '100.00',
          saidas: '300.00',
          saldo: '-200.00',
          saldoAcumulado: '-100.00',
          contasAReceberConhecidas: '0.00',
          contasAPagarConhecidas: '300.00',
        },
      ],
    });

    expect(resultado.modo).toBe('demonstracao');
    expect(resultado.analise.nivelRisco).toBe('alto');
    expect(resultado.inputTokens).toBe(0);
  });

  it('não promete resultado quando o caixa permanece positivo', async () => {
    const resultado = await assistente.analisarPrevisao({
      identificadorSeguro: 'teste',
      saldoAtual: '1000.00',
      historico: [],
      projecoes: [
        {
          mes: '2026-10',
          entradas: '500.00',
          saidas: '200.00',
          saldo: '300.00',
          saldoAcumulado: '1300.00',
          contasAReceberConhecidas: '500.00',
          contasAPagarConhecidas: '200.00',
        },
      ],
    });

    expect(resultado.analise.nivelRisco).toBe('baixo');
    expect(resultado.analise.avisos.join(' ')).toMatch(/estimativa/i);
  });
});
