import { diaEmSaoPaulo, fimDoDia, inicioDoDia, instanteDeHorarioLocal } from './fuso';

describe('fuso da empresa', () => {
  it('lê o horário digitado como horário de Brasília, onde quer que o servidor rode', () => {
    expect(instanteDeHorarioLocal('2026-08-20T14:30').toISOString()).toBe(
      '2026-08-20T17:30:00.000Z',
    );
    expect(instanteDeHorarioLocal('2026-08-20T14:30:59').toISOString()).toBe(
      '2026-08-20T17:30:00.000Z',
    );
  });

  it('um compromisso às 22h de Brasília continua no mesmo dia', () => {
    const vinteDuasHoras = instanteDeHorarioLocal('2026-08-20T22:00');

    expect(vinteDuasHoras.toISOString().slice(0, 10)).toBe('2026-08-21'); // em UTC já é amanhã
    expect(diaEmSaoPaulo(vinteDuasHoras)).toBe('2026-08-20');
  });

  it('o filtro de um dia cobre de 00:00 a 23:59:59.999 de Brasília', () => {
    expect(inicioDoDia('2026-08-20').toISOString()).toBe('2026-08-20T03:00:00.000Z');
    expect(fimDoDia('2026-08-20').toISOString()).toBe('2026-08-21T02:59:59.999Z');
    // O compromisso das 22h está dentro do dia 20, não do 21.
    const vinteDuas = instanteDeHorarioLocal('2026-08-20T22:00');
    expect(vinteDuas <= fimDoDia('2026-08-20')).toBe(true);
    expect(vinteDuas < inicioDoDia('2026-08-21')).toBe(true);
  });

  it('volta e ida dão o mesmo dia', () => {
    expect(diaEmSaoPaulo(instanteDeHorarioLocal('2026-12-31T23:59'))).toBe('2026-12-31');
    expect(diaEmSaoPaulo(instanteDeHorarioLocal('2027-01-01T00:00'))).toBe('2027-01-01');
  });
});
