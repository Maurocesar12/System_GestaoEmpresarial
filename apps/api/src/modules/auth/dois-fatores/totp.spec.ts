import {
  CifraSegredo,
  codificarBase32,
  codigoDoPasso,
  conferirCodigo,
  decodificarBase32,
  gerarCodigosRecuperacao,
  gerarSegredo,
  hashCodigoRecuperacao,
  passoAtual,
  urlOtpauth,
} from './totp';

/** O segredo dos vetores da RFC 6238: "12345678901234567890" em ASCII. */
const SEGREDO_RFC = codificarBase32(Buffer.from('12345678901234567890'));

describe('TOTP', () => {
  it('codifica base32 como a RFC 4648', () => {
    expect(SEGREDO_RFC).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
    expect(decodificarBase32(SEGREDO_RFC).toString()).toBe('12345678901234567890');
  });

  // Vetores do apêndice B da RFC 6238 (SHA-1), nos 6 dígitos finais — o que o app mostra.
  it.each([
    [59, '287082'],
    [1111111109, '081804'],
    [1111111111, '050471'],
    [1234567890, '005924'],
    [2000000000, '279037'],
  ])('bate com a RFC no instante %i', (segundos, esperado) => {
    expect(codigoDoPasso(SEGREDO_RFC, passoAtual(segundos * 1000))).toBe(esperado);
  });

  it('aceita o passo anterior e o seguinte, e devolve o passo do código', () => {
    const agora = 1_700_000_000_000;
    const passo = passoAtual(agora);

    expect(conferirCodigo(SEGREDO_RFC, codigoDoPasso(SEGREDO_RFC, passo), agora)).toBe(passo);
    expect(conferirCodigo(SEGREDO_RFC, codigoDoPasso(SEGREDO_RFC, passo - 1), agora)).toBe(
      passo - 1,
    );
    expect(conferirCodigo(SEGREDO_RFC, codigoDoPasso(SEGREDO_RFC, passo + 1), agora)).toBe(
      passo + 1,
    );
  });

  it('recusa código fora da janela de tolerância', () => {
    const agora = 1_700_000_000_000;
    const antigo = codigoDoPasso(SEGREDO_RFC, passoAtual(agora) - 2);

    expect(conferirCodigo(SEGREDO_RFC, antigo, agora)).toBeNull();
  });

  it.each(['12345', '1234567', 'abcdef', '', '12 456'])('recusa formato inválido: %p', (codigo) => {
    expect(conferirCodigo(SEGREDO_RFC, codigo)).toBeNull();
  });

  it('gera segredos de 160 bits, diferentes a cada vez', () => {
    const a = gerarSegredo();
    expect(decodificarBase32(a)).toHaveLength(20);
    expect(gerarSegredo()).not.toBe(a);
  });

  it('monta o link otpauth que os apps leem', () => {
    const url = new URL(urlOtpauth(SEGREDO_RFC, 'maria@empresa.com', 'Gestão Empresarial'));

    expect(url.protocol).toBe('otpauth:');
    expect(url.searchParams.get('secret')).toBe(SEGREDO_RFC);
    expect(url.searchParams.get('digits')).toBe('6');
    expect(decodeURIComponent(url.pathname)).toContain('maria@empresa.com');
  });
});

describe('códigos de recuperação', () => {
  it('gera dez códigos únicos no formato xxxx-xxxx, sem caracteres ambíguos', () => {
    const codigos = gerarCodigosRecuperacao();

    expect(codigos).toHaveLength(10);
    expect(new Set(codigos).size).toBe(10);
    for (const codigo of codigos)
      expect(codigo).toMatch(/^[a-hj-km-np-z2-9]{4}-[a-hj-km-np-z2-9]{4}$/);
  });

  it('o hash ignora maiúsculas, hífen e espaços', () => {
    const hash = hashCodigoRecuperacao('abcd-efgh');

    expect(hashCodigoRecuperacao('ABCD-EFGH')).toBe(hash);
    expect(hashCodigoRecuperacao('abcd efgh')).toBe(hash);
    expect(hashCodigoRecuperacao('abcdefgh')).toBe(hash);
    expect(hashCodigoRecuperacao('abcd-efgi')).not.toBe(hash);
  });
});

describe('cifra do segredo', () => {
  const cifra = new CifraSegredo('segredo-mestre-de-teste-com-mais-de-32-caracteres');

  it('cifra e decifra, com resultado diferente a cada vez', () => {
    const a = cifra.cifrar(SEGREDO_RFC);

    expect(a).not.toContain(SEGREDO_RFC);
    expect(cifra.cifrar(SEGREDO_RFC)).not.toBe(a);
    expect(cifra.decifrar(a)).toBe(SEGREDO_RFC);
  });

  it('recusa texto adulterado', () => {
    const cifrado = cifra.cifrar(SEGREDO_RFC);
    const partes = cifrado.split('.');
    partes[3] = partes[3]!.slice(0, -2) + (partes[3]!.endsWith('AA') ? 'BB' : 'AA');

    expect(() => cifra.decifrar(partes.join('.'))).toThrow();
  });

  it('recusa chave diferente', () => {
    const outra = new CifraSegredo('outro-segredo-mestre-com-mais-de-32-caracteres!!');

    expect(() => outra.decifrar(cifra.cifrar(SEGREDO_RFC))).toThrow();
  });
});
