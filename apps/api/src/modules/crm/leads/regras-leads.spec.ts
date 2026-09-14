import {
  filtroDeFrios,
  filtroDeLeads,
  maisAntigo,
  maisRecente,
  motivoDoFrio,
  situacaoDoLead,
} from './regras-leads';

const DESDE = new Date('2026-09-01T00:00:00Z');
const CORTE = new Date('2026-07-16T00:00:00Z');

describe('filtroDeLeads', () => {
  it('limita a janela de chegada e ignora filtros ausentes', () => {
    expect(filtroDeLeads(DESDE)).toEqual({ criadoEm: { gte: DESDE } });
  });

  it('exige ausência de qualquer contato para "aguardando"', () => {
    const filtro = filtroDeLeads(DESDE, { situacao: 'aguardando' });

    expect(filtro.atendimentos).toEqual({ none: {} });
    expect(filtro.agendamentos).toEqual({ none: {} });
    expect(filtro.orcamentos).toEqual({ none: {} });
  });

  it('em contato é quem foi tocado sem receber proposta', () => {
    const filtro = filtroDeLeads(DESDE, { situacao: 'em_contato' });

    expect(filtro.orcamentos).toEqual({ none: {} });
    expect(filtro.OR).toEqual([{ atendimentos: { some: {} } }, { agendamentos: { some: {} } }]);
  });

  it('mantém o filtro de origem junto com a situação', () => {
    expect(filtroDeLeads(DESDE, { origem: 'Instagram', situacao: 'ganho' })).toMatchObject({
      origem: 'Instagram',
      orcamentos: { some: { status: 'aprovado' } },
    });
  });
});

describe('filtroDeFrios', () => {
  it('exclui quem teve qualquer toque recente ou já tem retorno marcado', () => {
    const filtro = filtroDeFrios(CORTE);

    expect(filtro.criadoEm).toEqual({ lt: CORTE });
    expect(filtro.atendimentos).toEqual({ none: { data: { gte: CORTE } } });
    expect(filtro.agendamentos).toEqual({ none: { dataHora: { gte: CORTE } } });
    expect(filtro.lembretes).toEqual({ none: { status: 'pendente' } });
  });

  it('considera proposta aberta como negociação viva, mesmo antiga', () => {
    expect(filtroDeFrios(CORTE).orcamentos).toEqual({
      none: { OR: [{ status: 'aberto' }, { criadoEm: { gte: CORTE } }] },
    });
  });
});

describe('situacaoDoLead', () => {
  it('proposta aprovada vence qualquer outro sinal', () => {
    expect(situacaoDoLead([{ status: 'aberto' }, { status: 'aprovado' }], false)).toBe('ganho');
  });

  it('proposta aberta indica negociação em andamento', () => {
    expect(situacaoDoLead([{ status: 'recusado' }, { status: 'aberto' }], true)).toBe(
      'com_proposta',
    );
  });

  it('sem proposta, o que separa é ter havido contato', () => {
    expect(situacaoDoLead([], true)).toBe('em_contato');
    expect(situacaoDoLead([], false)).toBe('aguardando');
  });

  it('proposta recusada sem contato registrado ainda conta como contato feito', () => {
    // Emitir a proposta é, por si, um contato — quem a recebeu não está mais na
    // fila de espera.
    expect(situacaoDoLead([{ status: 'recusado' }], true)).toBe('em_contato');
  });
});

describe('motivoDoFrio', () => {
  it('quem já comprou vem antes de qualquer outro motivo', () => {
    expect(motivoDoFrio('recusado', 2)).toBe('comprou_e_sumiu');
  });

  it('separa recusa explícita de silêncio', () => {
    expect(motivoDoFrio('recusado', 0)).toBe('proposta_recusada');
    expect(motivoDoFrio('aberto', 0)).toBe('proposta_sem_resposta');
  });

  it('sem nenhuma proposta, o motivo é nunca ter avançado', () => {
    expect(motivoDoFrio(undefined, 0)).toBe('nunca_fechou');
  });
});

describe('maisAntigo e maisRecente', () => {
  const cedo = new Date('2026-01-01T10:00:00Z');
  const tarde = new Date('2026-03-01T10:00:00Z');

  it('ignoram ausências sem deslocar o resultado', () => {
    expect(maisAntigo([undefined, tarde, null, cedo])).toEqual(cedo);
    expect(maisRecente([undefined, cedo, null, tarde])).toEqual(tarde);
  });

  it('devolvem nulo quando não há nenhuma data', () => {
    expect(maisAntigo([undefined, null])).toBeNull();
    expect(maisRecente([])).toBeNull();
  });
});
