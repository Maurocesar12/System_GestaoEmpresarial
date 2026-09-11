import { mesesEntre, primeiroDiaDeMesesAtras, ultimoDiaDoMesPassado } from './datas';

describe('janela das médias mensais', () => {
  it('começa no dia 1 do mês indicado', () => {
    expect(primeiroDiaDeMesesAtras(3, '2026-09-11')).toBe('2026-06-01');
  });

  it('termina no último dia do mês passado', () => {
    expect(ultimoDiaDoMesPassado('2026-09-11')).toBe('2026-08-31');
    // Fevereiro bissexto sem tabela de dias.
    expect(ultimoDiaDoMesPassado('2024-03-05')).toBe('2024-02-29');
  });
});

describe('mesesEntre', () => {
  it('conta o primeiro e o último mês', () => {
    expect(mesesEntre('2026-06-01', '2026-08-31')).toBe(3);
  });

  it('conta meses do calendário, não períodos de 30 dias', () => {
    // 15 de janeiro a 3 de março toca três meses, ainda que sejam ~47 dias.
    expect(mesesEntre('2026-01-15', '2026-03-03')).toBe(3);
  });

  it('devolve 1 quando começa e termina no mesmo mês', () => {
    expect(mesesEntre('2026-08-02', '2026-08-31')).toBe(1);
  });

  it('atravessa a virada do ano', () => {
    expect(mesesEntre('2025-11-01', '2026-02-28')).toBe(4);
  });

  // Acontece quando a empresa só tem movimento no mês corrente: a janela das
  // médias fecha no mês passado, então o início fica depois do fim.
  it('devolve zero quando o fim é anterior ao início', () => {
    expect(mesesEntre('2026-09-01', '2026-08-31')).toBe(0);
  });
});
