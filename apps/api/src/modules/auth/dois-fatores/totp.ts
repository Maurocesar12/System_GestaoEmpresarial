import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  hkdfSync,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from 'node:crypto';

/**
 * TOTP (RFC 6238) e o que gira em volta dele, sem dependência externa.
 *
 * O algoritmo é curto e estável há mais de uma década: HMAC-SHA1 sobre o
 * número do passo de 30 segundos, truncado em 6 dígitos. Escrito aqui, cabe
 * num teste com os vetores oficiais da RFC — uma biblioteca seria mais código
 * para auditar do que o próprio algoritmo.
 *
 * SHA-1, 6 dígitos e 30 s não são escolha nossa: é o único perfil que todo app
 * autenticador (Google, Microsoft, Authy, 1Password) aceita sem configuração.
 */

export const DIGITOS = 6;
export const PERIODO_SEGUNDOS = 30;
/** Aceita o passo anterior e o seguinte: relógio do celular adiantado ou atrasado. */
const TOLERANCIA_PASSOS = 1;

const ALFABETO_BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function codificarBase32(bytes: Buffer): string {
  let bits = 0;
  let valor = 0;
  let saida = '';

  for (const byte of bytes) {
    valor = (valor << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      saida += ALFABETO_BASE32[(valor >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) saida += ALFABETO_BASE32[(valor << (5 - bits)) & 31];
  return saida;
}

export function decodificarBase32(texto: string): Buffer {
  const limpo = texto.replace(/[\s=-]/g, '').toUpperCase();
  let bits = 0;
  let valor = 0;
  const saida: number[] = [];

  for (const caractere of limpo) {
    const indice = ALFABETO_BASE32.indexOf(caractere);
    if (indice < 0) throw new Error('Segredo base32 inválido.');
    valor = (valor << 5) | indice;
    bits += 5;
    if (bits >= 8) {
      saida.push((valor >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(saida);
}

/** 160 bits, o tamanho que a RFC 4226 recomenda para HMAC-SHA1. */
export function gerarSegredo(): string {
  return codificarBase32(randomBytes(20));
}

export function passoAtual(agoraMs = Date.now()): number {
  return Math.floor(agoraMs / 1000 / PERIODO_SEGUNDOS);
}

/** HOTP (RFC 4226) para um passo — o TOTP é isto com o passo vindo do relógio. */
export function codigoDoPasso(segredo: string, passo: number): string {
  const contador = Buffer.alloc(8);
  contador.writeBigUInt64BE(BigInt(passo));

  const hmac = createHmac('sha1', decodificarBase32(segredo)).update(contador).digest();
  const deslocamento = hmac[hmac.length - 1]! & 0x0f;
  const binario = hmac.readUInt32BE(deslocamento) & 0x7fffffff;

  return String(binario % 10 ** DIGITOS).padStart(DIGITOS, '0');
}

/**
 * Confere um código e devolve o passo a que ele pertence, ou `null`.
 *
 * Devolver o passo é o que permite barrar replay: quem chama grava o passo
 * aceito e recusa qualquer código de passo igual ou anterior.
 */
export function conferirCodigo(
  segredo: string,
  codigo: string,
  agoraMs = Date.now(),
): number | null {
  if (!new RegExp(`^\\d{${DIGITOS}}$`).test(codigo)) return null;

  const atual = passoAtual(agoraMs);
  const recebido = Buffer.from(codigo);

  for (let desvio = -TOLERANCIA_PASSOS; desvio <= TOLERANCIA_PASSOS; desvio++) {
    const passo = atual + desvio;
    // Comparação em tempo constante: o tempo de resposta não pode revelar
    // quantos dígitos do palpite estavam certos.
    if (timingSafeEqual(Buffer.from(codigoDoPasso(segredo, passo)), recebido)) return passo;
  }

  return null;
}

/** O link que o QR code carrega; é o formato que todo app autenticador lê. */
export function urlOtpauth(segredo: string, conta: string, emissor: string): string {
  const rotulo = encodeURIComponent(`${emissor}:${conta}`);
  const parametros = new URLSearchParams({
    secret: segredo,
    issuer: emissor,
    algorithm: 'SHA1',
    digits: String(DIGITOS),
    period: String(PERIODO_SEGUNDOS),
  });
  return `otpauth://totp/${rotulo}?${parametros.toString()}`;
}

/** Sem 0/o, 1/l/i: o código é lido de um papel e digitado à mão. */
const ALFABETO_RECUPERACAO = 'abcdefghjkmnpqrstuvwxyz23456789';
export const QUANTIDADE_CODIGOS_RECUPERACAO = 10;

/** Códigos `xxxx-xxxx`, ~39 bits cada — com o bloqueio por erros, sobra. */
export function gerarCodigosRecuperacao(quantidade = QUANTIDADE_CODIGOS_RECUPERACAO): string[] {
  return Array.from({ length: quantidade }, () => {
    const caracteres = Array.from(
      { length: 8 },
      () => ALFABETO_RECUPERACAO[randomInt(ALFABETO_RECUPERACAO.length)],
    ).join('');
    return `${caracteres.slice(0, 4)}-${caracteres.slice(4)}`;
  });
}

/** Igual para `ABCD-EFGH`, `abcd efgh` e `abcdefgh`: a pessoa digita como quiser. */
export function hashCodigoRecuperacao(codigo: string): string {
  const normalizado = codigo.toLowerCase().replace(/[^a-z0-9]/g, '');
  return createHash('sha256').update(normalizado).digest('hex');
}

/**
 * Cifra do segredo no banco (AES-256-GCM).
 *
 * A chave é derivada do `JWT_SECRET` por HKDF, com um rótulo próprio: não é a
 * mesma chave que assina os tokens, e não exige uma variável nova no Render.
 * Consequência a conhecer: trocar o `JWT_SECRET` invalida os segredos
 * gravados, e todos precisam configurar o app de novo.
 */
export class CifraSegredo {
  private readonly chave: Buffer;

  constructor(segredoMestre: string) {
    this.chave = Buffer.from(
      hkdfSync('sha256', segredoMestre, '', 'gestao:dois-fatores:segredo', 32),
    );
  }

  cifrar(texto: string): string {
    const iv = randomBytes(12);
    const cifra = createCipheriv('aes-256-gcm', this.chave, iv);
    const conteudo = Buffer.concat([cifra.update(texto, 'utf8'), cifra.final()]);
    const etiqueta = cifra.getAuthTag();
    return ['v1', iv, etiqueta, conteudo]
      .map((parte) => (typeof parte === 'string' ? parte : parte.toString('base64url')))
      .join('.');
  }

  /** Lança se o texto foi adulterado ou cifrado com outra chave. */
  decifrar(cifrado: string): string {
    const [versao, iv, etiqueta, conteudo] = cifrado.split('.');
    if (versao !== 'v1' || !iv || !etiqueta || !conteudo)
      throw new Error('Segredo cifrado inválido.');

    const decifra = createDecipheriv('aes-256-gcm', this.chave, Buffer.from(iv, 'base64url'));
    decifra.setAuthTag(Buffer.from(etiqueta, 'base64url'));
    return Buffer.concat([
      decifra.update(Buffer.from(conteudo, 'base64url')),
      decifra.final(),
    ]).toString('utf8');
  }
}
