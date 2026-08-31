import { statusDoLancamento } from '@gestao/shared-types';

/**
 * A regra que separa pago, a vencer e atrasado.
 *
 * Mora no contrato compartilhado porque API e tela precisam chegar ao mesmo
 * resultado — e é testada aqui, junto do resto da suíte da API, por ser onde a
 * decisão vira dado exposto ao usuário.
 */
describe('statusDoLancamento', () => {
  const HOJE = '2026-08-31';

  it('considera pago assim que existe data de pagamento', () => {
    expect(statusDoLancamento('2026-08-01', '2026-08-05', HOJE)).toBe('pago');
  });

  it('continua pago mesmo tendo vencido antes da baixa', () => {
    // Pagar com atraso resolve o atraso. O que importa para a situação atual é
    // que o dinheiro entrou.
    expect(statusDoLancamento('2026-07-01', '2026-08-20', HOJE)).toBe('pago');
  });

  it('marca como atrasado o que venceu ontem e não foi pago', () => {
    expect(statusDoLancamento('2026-08-30', null, HOJE)).toBe('atrasado');
  });

  it('não considera atrasado o que vence hoje', () => {
    // O prazo é o dia inteiro: cobrar alguém às 8h de um boleto que vence às
    // 23h59 seria errado.
    expect(statusDoLancamento(HOJE, null, HOJE)).toBe('a_vencer');
  });

  it('considera a vencer o que ainda tem prazo', () => {
    expect(statusDoLancamento('2026-09-10', null, HOJE)).toBe('a_vencer');
  });

  it('nunca marca como atrasado um lançamento sem vencimento', () => {
    // Sem prazo não há prazo estourado. O caso existe: lançamento à vista que
    // ainda não teve baixa.
    expect(statusDoLancamento(null, null, HOJE)).toBe('a_vencer');
  });

  it('compara datas por texto sem tropeçar na virada de mês', () => {
    // `AAAA-MM-DD` ordena alfabeticamente igual ao calendário — é o que permite
    // comparar sem converter para Date, onde o fuso do servidor mudaria o dia.
    expect(statusDoLancamento('2026-08-31', null, '2026-09-01')).toBe('atrasado');
    expect(statusDoLancamento('2026-09-01', null, '2026-08-31')).toBe('a_vencer');
  });

  it('trata a virada de ano corretamente', () => {
    expect(statusDoLancamento('2026-12-31', null, '2027-01-01')).toBe('atrasado');
  });
});
