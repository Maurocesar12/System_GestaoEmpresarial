import { CAMPO_ARMADILHA, leadPublicoSchema } from '@gestao/shared-types';

/**
 * O contrato do único endpoint que grava sem autenticação.
 *
 * O que se testa aqui é o que o servidor aceita **antes** de qualquer regra de
 * negócio rodar: é a primeira porta, e a única que existe entre a internet
 * aberta e a tabela de clientes.
 */
describe('formulário público de leads', () => {
  const valido = {
    chave: '01a073ac-49a1-7c56-b197-2a2488a061a6.abc123def456',
    nome: 'Maria Souza',
    consentimento: true,
  };

  it('aceita o mínimo: chave, nome e consentimento', () => {
    const resultado = leadPublicoSchema.safeParse(valido);

    expect(resultado.success).toBe(true);
  });

  // Sem base legal registrada não há por que guardar o dado (LGPD, §9.4).
  it('recusa envio sem consentimento', () => {
    expect(leadPublicoSchema.safeParse({ ...valido, consentimento: false }).success).toBe(false);
    expect(
      leadPublicoSchema.safeParse({ chave: valido.chave, nome: valido.nome }).success,
    ).toBe(false);
  });

  it('recusa nome ausente ou curto demais', () => {
    expect(leadPublicoSchema.safeParse({ ...valido, nome: 'M' }).success).toBe(false);
    expect(leadPublicoSchema.safeParse({ ...valido, nome: '' }).success).toBe(false);
  });

  it('recusa chave curta demais para ter prefixo e segredo', () => {
    expect(leadPublicoSchema.safeParse({ ...valido, chave: 'curta' }).success).toBe(false);
  });

  /*
   * O campo-armadilha precisa **passar** pela validação para que o serviço
   * possa vê-lo preenchido e descartar o envio em silêncio. Recusar aqui
   * devolveria erro de validação, que é justamente a resposta diferente que
   * ensina o robô a contornar a regra.
   */
  it('deixa o campo-armadilha atravessar a validação', () => {
    const resultado = leadPublicoSchema.safeParse({
      ...valido,
      [CAMPO_ARMADILHA]: 'preenchido por robô',
    });

    expect(resultado.success).toBe(true);
    expect(resultado.success && resultado.data[CAMPO_ARMADILHA]).toBe('preenchido por robô');
  });

  it('normaliza campos vazios para nulo, como o cadastro normal', () => {
    const resultado = leadPublicoSchema.safeParse({
      ...valido,
      email: '',
      telefone: '',
      utmSource: '',
    });

    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.email).toBeNull();
      expect(resultado.data.telefone).toBeNull();
      expect(resultado.data.utmSource).toBeNull();
    }
  });

  it('recusa e-mail malformado em vez de gravar lixo', () => {
    expect(leadPublicoSchema.safeParse({ ...valido, email: 'não-é-email' }).success).toBe(false);
  });

  // Zod descarta chave desconhecida por padrão: é o que impede alguém de
  // enviar `tenantId` ou `papel` no corpo e ver se alguma coisa aproveita.
  it('descarta campos desconhecidos', () => {
    const resultado = leadPublicoSchema.safeParse({ ...valido, tenantId: 'outra-empresa' });

    expect(resultado.success).toBe(true);
    expect(resultado.success && 'tenantId' in resultado.data).toBe(false);
  });
});
