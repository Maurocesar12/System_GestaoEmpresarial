import {
  MINIMO_LANCAMENTOS_PAGOS,
  MINIMO_MESES_COM_MOVIMENTO,
  motivoParaNaoPrever,
} from './suficiencia-previsao';

const comMovimento = { entradas: '1500.00', saidas: '800.00' };
const parado = { entradas: '0.00', saidas: '0.00' };

describe('dados mínimos para a previsão', () => {
  it('libera com o mínimo exato de meses e lançamentos', () => {
    expect(
      motivoParaNaoPrever({
        historico: [parado, parado, parado, comMovimento, comMovimento, comMovimento],
        lancamentosPagos: MINIMO_LANCAMENTOS_PAGOS,
      }),
    ).toBeNull();
  });

  it('recusa quando faltam meses com movimento, mesmo com muitos lançamentos', () => {
    const motivo = motivoParaNaoPrever({
      historico: [parado, parado, parado, parado, comMovimento, comMovimento],
      lancamentosPagos: 50,
    });

    expect(motivo).toContain(`pelo menos ${MINIMO_MESES_COM_MOVIMENTO} meses`);
    expect(motivo).toContain('Hoje há 2 meses com movimento');
  });

  // Três meses com um lançamento cada passariam no critério de meses; é o
  // segundo critério que impede projetar a partir de quase nada.
  it('recusa quando há meses suficientes mas poucos lançamentos', () => {
    const motivo = motivoParaNaoPrever({
      historico: [comMovimento, comMovimento, comMovimento],
      lancamentosPagos: MINIMO_LANCAMENTOS_PAGOS - 1,
    });

    expect(motivo).toContain(`${MINIMO_LANCAMENTOS_PAGOS - 1} lançamentos pagos`);
  });

  it('conta como movimento o mês que só teve saída', () => {
    const soSaida = { entradas: '0.00', saidas: '420.00' };

    expect(
      motivoParaNaoPrever({
        historico: [soSaida, soSaida, soSaida],
        lancamentosPagos: MINIMO_LANCAMENTOS_PAGOS,
      }),
    ).toBeNull();
  });

  it('explica o caso da conta vazia no singular e no plural certos', () => {
    expect(
      motivoParaNaoPrever({ historico: [parado, comMovimento], lancamentosPagos: 1 }),
    ).toContain('Hoje há 1 mês com movimento e 1 lançamento pago');
    expect(motivoParaNaoPrever({ historico: [parado, parado], lancamentosPagos: 0 })).toContain(
      'Hoje há 0 meses com movimento e 0 lançamentos pagos',
    );
  });

  it('avisa que a tentativa recusada não gastou previsão', () => {
    expect(motivoParaNaoPrever({ historico: [parado], lancamentosPagos: 0 })).toContain(
      'não contou na sua cota',
    );
  });
});
