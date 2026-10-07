import { BadRequestException } from '@nestjs/common';
import {
  CODIGOS_ERRO,
  MAX_BYTES_ANEXO_LANCAMENTO,
  MIME_TYPES_ANEXO_LANCAMENTO,
  type AnexoLancamentoInput,
} from '@gestao/shared-types';
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFStream, type PDFObject } from 'pdf-lib';
import sharp from 'sharp';

type TipoAnexo = (typeof MIME_TYPES_ANEXO_LANCAMENTO)[number];

/**
 * A assinatura de cada formato aceito: os primeiros bytes do arquivo.
 *
 * O `mimeType` e o prefixo `data:` são texto que o navegador escreve — e
 * qualquer um reescreve. Um HTML ou executável renomeado passava pelo schema
 * com o prefixo certo. Os bytes do começo do arquivo são o que o formato é de
 * verdade, e não dependem de quem enviou.
 */
const ASSINATURAS: Record<TipoAnexo, (bytes: Buffer) => boolean> = {
  'application/pdf': (b) => b.subarray(0, 5).toString('latin1') === '%PDF-',
  'image/png': (b) =>
    b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/webp': (b) =>
    b.subarray(0, 4).toString('latin1') === 'RIFF' &&
    b.subarray(8, 12).toString('latin1') === 'WEBP',
};

const EXTENSAO: Record<TipoAnexo, string> = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

/** O formato que o `sharp` reconhece para cada tipo de imagem aceito. */
const FORMATO_SHARP = { 'image/png': 'png', 'image/jpeg': 'jpeg', 'image/webp': 'webp' } as const;

/**
 * Teto de pixels de uma imagem. Uma "bomba de descompressão" é um PNG de
 * poucos KB que se abre em gigabytes de memória; 40 milhões de pixels cobre
 * qualquer foto de celular ou nota escaneada com folga.
 */
const MAX_PIXELS_IMAGEM = 40_000_000;

/**
 * O que, dentro de um PDF, executa algo ou carrega outro arquivo.
 *
 * Nota fiscal e boleto não precisam de nada disto — é o repertório de PDF
 * malicioso: JavaScript, ações que disparam ao abrir, programas embutidos,
 * formulários que enviam dados para fora.
 */
// `/OpenAction` e `/AA` ficam de fora de propósito: o Word e os emissores de
// nota usam "abrir na página 1" sem nada de perigoso. O que importa é a ação
// para onde eles apontam, e essa é pega pelo tipo (`/S /JavaScript`, `/Launch`…).
const CHAVES_PERIGOSAS = new Set(
  ['JS', 'JavaScript', 'Launch', 'EmbeddedFile', 'EmbeddedFiles', 'RichMedia', 'XFA'].map((nome) =>
    PDFName.of(nome),
  ),
);
const ACOES_PERIGOSAS = new Set(
  [
    'JavaScript',
    'Launch',
    'SubmitForm',
    'ImportData',
    'GoToR',
    'GoToE',
    'Rendition',
    'Movie',
    'Sound',
    'RichMediaExecute',
    'EmbeddedFile',
    'Filespec',
  ].map((nome) => PDFName.of(nome)),
);
const CHAVE_ACAO = PDFName.of('S');
const CHAVE_TIPO = PDFName.of('Type');

export interface AnexoConferido {
  nome: string;
  mimeType: TipoAnexo;
  /** Medido pelo servidor a partir do conteúdo, nunca o valor declarado. */
  tamanhoBytes: number;
  conteudo: string;
}

function recusar(indice: number, mensagem: string): never {
  throw new BadRequestException({
    codigo: CODIGOS_ERRO.VALIDACAO,
    mensagem,
    detalhes: { [`anexos.${indice}.conteudo`]: [mensagem] },
  });
}

/**
 * Nome que pode ser mostrado e baixado sem surpresa.
 *
 * Tira caracteres de controle, os de caminho (`/ \ :`), os que o Windows
 * proíbe e os de direção de texto — `fatura\u202efdp.exe` aparece na tela como
 * `fatura.exe.pdf` graças a um deles. E a extensão final é sempre a do tipo
 * real do arquivo: `nota.pdf.exe` vira `nota.pdf.pdf`.
 */
export function nomeSeguro(nome: string, tipo: TipoAnexo): string {
  const limpo = nome
    .normalize('NFC')
    // eslint-disable-next-line no-control-regex -- remover esses caracteres é o objetivo
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '')
    .replace(/^[\s.]+/, '')
    .trim();
  const semExtensao = limpo
    .replace(/\.[^.]*$/, '')
    .slice(0, 150)
    .trim();

  return `${semExtensao || 'anexo'}.${EXTENSAO[tipo]}`;
}

/** Procura, recursivamente, algo executável dentro de um objeto do PDF. */
function temConteudoAtivo(objeto: PDFObject, profundidade = 0): boolean {
  // Objetos indiretos são visitados um a um pelo laço de fora; aqui só os
  // diretos, aninhados. O teto de profundidade barra PDFs feitos para estourar
  // a pilha.
  if (profundidade > 64) return true;

  const dicionario =
    objeto instanceof PDFDict ? objeto : objeto instanceof PDFStream ? objeto.dict : undefined;

  if (dicionario) {
    for (const [chave, valor] of dicionario.entries()) {
      if (CHAVES_PERIGOSAS.has(chave)) return true;
      if ((chave === CHAVE_ACAO || chave === CHAVE_TIPO) && valor instanceof PDFName) {
        if (ACOES_PERIGOSAS.has(valor)) return true;
      }
      if (temConteudoAtivo(valor, profundidade + 1)) return true;
    }
    return false;
  }

  if (objeto instanceof PDFArray) {
    return objeto.asArray().some((item) => temConteudoAtivo(item, profundidade + 1));
  }

  return false;
}

/**
 * Abre o PDF de verdade e varre todos os objetos dele.
 *
 * Procurar `/JavaScript` nos bytes não basta: desde o PDF 1.5 os objetos
 * podem vir compactados dentro de "object streams", e o texto não aparece no
 * arquivo. O `pdf-lib` descompacta e entrega cada objeto, inclusive os de
 * atualizações incrementais acrescentadas no fim do arquivo.
 */
async function motivoPdfRecusado(bytes: Buffer): Promise<string | undefined> {
  let documento: PDFDocument;
  try {
    // `ignoreEncryption` só para conseguir abrir e perguntar `isEncrypted`: o
    // erro que a biblioteca lança para PDF com senha não passa no `instanceof`.
    documento = await PDFDocument.load(bytes, { updateMetadata: false, ignoreEncryption: true });
  } catch {
    return 'está corrompido ou fora do padrão PDF';
  }

  // Com senha, o conteúdo não pode ser inspecionado — então não entra.
  if (documento.isEncrypted) {
    return 'está protegido por senha. Envie uma versão sem senha';
  }

  for (const [, objeto] of documento.context.enumerateIndirectObjects()) {
    if (temConteudoAtivo(objeto)) {
      return 'tem scripts, ações automáticas ou arquivos embutidos. Abra o arquivo e use "Imprimir → Salvar como PDF" para gerar uma cópia limpa';
    }
  }

  return undefined;
}

/**
 * Gera a imagem de novo, do zero, a partir dos pixels.
 *
 * O arquivo guardado é o que o servidor produziu, nunca o que chegou. Isso
 * descarta tudo que não é imagem: código escondido depois dos dados (arquivos
 * "poliglotas", que são imagem e outra coisa ao mesmo tempo), metadados com
 * GPS de onde a foto foi tirada, perfis e comentários.
 */
async function recodificarImagem(
  bytes: Buffer,
  tipo: keyof typeof FORMATO_SHARP,
): Promise<Buffer | undefined> {
  try {
    const entrada = sharp(bytes, { limitInputPixels: MAX_PIXELS_IMAGEM, failOn: 'error' });
    const { format } = await entrada.metadata();
    if (format !== FORMATO_SHARP[tipo]) return undefined;

    // `rotate()` sem argumento aplica a orientação do EXIF antes de ele ser
    // descartado — senão a foto tirada em pé ficaria deitada.
    const imagem = entrada.rotate();
    if (tipo === 'image/png') return await imagem.png({ compressionLevel: 9 }).toBuffer();
    if (tipo === 'image/jpeg') return await imagem.jpeg({ quality: 85, mozjpeg: true }).toBuffer();
    return await imagem.webp({ quality: 85 }).toBuffer();
  } catch {
    return undefined;
  }
}

/**
 * Confere o arquivo pelo conteúdo, e não pelo que o navegador disse dele.
 *
 *  1. o prefixo `data:` tem de ser o mesmo tipo declarado em `mimeType`;
 *  2. o base64 decodificado precisa começar com a assinatura daquele tipo;
 *  3. o tamanho que vale é o dos bytes decodificados;
 *  4. PDF: nada executável dentro; imagem: recodificada pelo servidor;
 *  5. o nome é higienizado e ganha a extensão do tipo real.
 */
export async function conferirAnexo(
  anexo: AnexoLancamentoInput,
  indice: number,
): Promise<AnexoConferido> {
  const nome = nomeSeguro(anexo.nome, anexo.mimeType);
  const separador = anexo.conteudo.indexOf(',');
  const cabecalho = anexo.conteudo.slice(0, separador);
  const tipoNoPrefixo = cabecalho.slice('data:'.length, cabecalho.indexOf(';'));

  if (separador < 0 || tipoNoPrefixo !== anexo.mimeType) {
    recusar(indice, `O arquivo "${nome}" não corresponde ao tipo informado.`);
  }

  const base64 = anexo.conteudo.slice(separador + 1);

  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) {
    recusar(indice, `O arquivo "${nome}" está corrompido.`);
  }

  const bytes = Buffer.from(base64, 'base64');

  if (bytes.length === 0) {
    recusar(indice, `O arquivo "${nome}" está vazio.`);
  }

  if (bytes.length > MAX_BYTES_ANEXO_LANCAMENTO) {
    recusar(indice, `O arquivo "${nome}" passa de 2 MB.`);
  }

  if (!ASSINATURAS[anexo.mimeType](bytes)) {
    recusar(
      indice,
      `O arquivo "${nome}" não é um ${anexo.mimeType === 'application/pdf' ? 'PDF' : 'imagem'} válido. Envie PDF, PNG, JPG ou WebP.`,
    );
  }

  if (anexo.mimeType === 'application/pdf') {
    const motivo = await motivoPdfRecusado(bytes);
    if (motivo) recusar(indice, `O PDF "${nome}" ${motivo}.`);

    return { nome, mimeType: anexo.mimeType, tamanhoBytes: bytes.length, conteudo: anexo.conteudo };
  }

  const limpa = await recodificarImagem(bytes, anexo.mimeType);
  if (!limpa) {
    recusar(indice, `A imagem "${nome}" está corrompida ou é grande demais para abrir.`);
  }
  if (limpa.length > MAX_BYTES_ANEXO_LANCAMENTO) {
    recusar(indice, `A imagem "${nome}" passa de 2 MB. Envie uma foto menor.`);
  }

  return {
    nome,
    mimeType: anexo.mimeType,
    tamanhoBytes: limpa.length,
    conteudo: `data:${anexo.mimeType};base64,${limpa.toString('base64')}`,
  };
}

/** Confere todos, um por vez: cinco imagens grandes ao mesmo tempo pesariam na memória. */
export async function conferirAnexos(
  anexos: readonly AnexoLancamentoInput[],
): Promise<AnexoConferido[]> {
  const conferidos: AnexoConferido[] = [];
  for (const [indice, anexo] of anexos.entries()) {
    conferidos.push(await conferirAnexo(anexo, indice));
  }
  return conferidos;
}
