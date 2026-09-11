import { calcularAcesso, mensagemDeAcesso, somarUmMes } from '@gestao/shared-types';

const HOJE = new Date('2026-09-11T14:00:00Z');
/** `AAAA-MM-DD` em epoch UTC. O mês do `Date.UTC` começa em zero. */
const dia = (valor: string) => {
  const [ano, mes, diaDoMes] = valor.split('-').map(Number) as [number, number, number];

  return Date.UTC(ano, mes - 1, diaDoMes);
};

describe('somarUmMes', () => {
  it('mantém o mesmo dia no mês seguinte', () => {
    expect(new Date(somarUmMes(dia('2026-09-10')))).toEqual(new Date('2026-10-10T00:00:00Z'));
  });

  // Sem isto, quem paga dia 31 ganharia dias de brinde em fevereiro.
  it('prende no último dia quando o mês seguinte é mais curto', () => {
    expect(new Date(somarUmMes(dia('2026-01-31')))).toEqual(new Date('2026-02-28T00:00:00Z'));
    expect(new Date(somarUmMes(dia('2024-01-31')))).toEqual(new Date('2024-02-29T00:00:00Z'));
  });

  it('atravessa a virada do ano', () => {
    expect(new Date(somarUmMes(dia('2026-12-15')))).toEqual(new Date('2027-01-15T00:00:00Z'));
  });
});

describe('calcularAcesso', () => {
  it('libera quem está dentro do mês pago', () => {
    const situacao = calcularAcesso({ status: 'ativo', ultimoPagamentoEm: '2026-08-20' }, HOJE);

    expect(situacao).toMatchObject({ liberado: true, motivo: 'pago', acessoAte: '2026-09-20' });
    expect(situacao.diasRestantes).toBe(9);
  });

  it('libera no último dia do prazo', () => {
    // Quem pagou em 11 de agosto tem o dia 11 de setembro inteiro.
    const situacao = calcularAcesso({ status: 'ativo', ultimoPagamentoEm: '2026-08-11' }, HOJE);

    expect(situacao).toMatchObject({ liberado: true, diasRestantes: 0 });
  });

  it('bloqueia no dia seguinte ao vencimento', () => {
    const situacao = calcularAcesso({ status: 'ativo', ultimoPagamentoEm: '2026-08-10' }, HOJE);

    expect(situacao).toMatchObject({ liberado: false, motivo: 'vencido', diasRestantes: -1 });
  });

  it('usa o fim do teste enquanto não houve pagamento', () => {
    const situacao = calcularAcesso({ status: 'trial', trialTerminaEm: '2026-09-18' }, HOJE);

    expect(situacao).toMatchObject({ liberado: true, motivo: 'trial', acessoAte: '2026-09-18' });
  });

  it('bloqueia quando o teste terminou e não houve pagamento', () => {
    const situacao = calcularAcesso({ status: 'trial', trialTerminaEm: '2026-09-01' }, HOJE);

    expect(situacao).toMatchObject({ liberado: false, motivo: 'sem_pagamento' });
  });

  // Pagar no meio do teste não pode encurtar o acesso de quem pagou.
  it('deixa o pagamento mandar sobre o fim do teste', () => {
    const situacao = calcularAcesso(
      { status: 'ativo', trialTerminaEm: '2026-09-12', ultimoPagamentoEm: '2026-09-05' },
      HOJE,
    );

    expect(situacao).toMatchObject({ liberado: true, acessoAte: '2026-10-05' });
  });

  it('bloqueia conta cancelada mesmo com pagamento em dia', () => {
    const situacao = calcularAcesso({ status: 'cancelado', ultimoPagamentoEm: '2026-09-10' }, HOJE);

    expect(situacao).toMatchObject({ liberado: false, motivo: 'cancelado', acessoAte: null });
  });

  it('bloqueia quando não há teste nem pagamento', () => {
    expect(calcularAcesso({ status: 'ativo' }, HOJE)).toMatchObject({
      liberado: false,
      motivo: 'sem_pagamento',
      acessoAte: null,
    });
  });

  // O horário do pagamento não pode tirar um dia de quem pagou à noite.
  it('compara por dia, não por hora', () => {
    const situacao = calcularAcesso(
      { status: 'ativo', ultimoPagamentoEm: '2026-08-11T23:50:00Z' },
      new Date('2026-09-11T00:10:00Z'),
    );

    expect(situacao.liberado).toBe(true);
  });
});

describe('mensagemDeAcesso', () => {
  it('diz a data do vencimento para quem ainda está em dia', () => {
    const situacao = calcularAcesso({ status: 'ativo', ultimoPagamentoEm: '2026-08-20' }, HOJE);

    expect(mensagemDeAcesso(situacao)).toContain('20/09/2026');
  });

  it('pede o pagamento de quem venceu', () => {
    const situacao = calcularAcesso({ status: 'ativo', ultimoPagamentoEm: '2026-07-01' }, HOJE);

    expect(mensagemDeAcesso(situacao)).toBe(
      'Seu acesso venceu em 01/08/2026. Realize o pagamento para voltar a usar o sistema.',
    );
  });
});
