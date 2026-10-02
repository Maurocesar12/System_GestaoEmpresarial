import { BadRequestException } from '@nestjs/common';
import {
  CODIGOS_ERRO,
  MAX_BYTES_ANEXO_LANCAMENTO,
  MIME_TYPES_ANEXO_LANCAMENTO,
  type AnexoLancamentoInput,
} from '@gestao/shared-types';

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
 * Confere o arquivo pelo conteúdo, e não pelo que o navegador disse dele.
 *
 * Três conferências, todas no servidor:
 *  1. o prefixo `data:` tem de ser o mesmo tipo declarado em `mimeType`;
 *  2. o base64 decodificado precisa começar com a assinatura daquele tipo;
 *  3. o tamanho que vale é o dos bytes decodificados — o `tamanhoBytes` que
 *     veio no corpo é ignorado, porque era só um número que o cliente escrevia.
 */
export function conferirAnexo(anexo: AnexoLancamentoInput, indice: number): AnexoConferido {
  const separador = anexo.conteudo.indexOf(',');
  const cabecalho = anexo.conteudo.slice(0, separador);
  const tipoNoPrefixo = cabecalho.slice('data:'.length, cabecalho.indexOf(';'));

  if (separador < 0 || tipoNoPrefixo !== anexo.mimeType) {
    recusar(indice, `O arquivo "${anexo.nome}" não corresponde ao tipo informado.`);
  }

  const base64 = anexo.conteudo.slice(separador + 1);

  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) {
    recusar(indice, `O arquivo "${anexo.nome}" está corrompido.`);
  }

  const bytes = Buffer.from(base64, 'base64');

  if (bytes.length === 0) {
    recusar(indice, `O arquivo "${anexo.nome}" está vazio.`);
  }

  if (bytes.length > MAX_BYTES_ANEXO_LANCAMENTO) {
    recusar(indice, `O arquivo "${anexo.nome}" passa de 2 MB.`);
  }

  if (!ASSINATURAS[anexo.mimeType](bytes)) {
    recusar(
      indice,
      `O arquivo "${anexo.nome}" não é um ${anexo.mimeType === 'application/pdf' ? 'PDF' : 'imagem'} válido. Envie PDF, PNG, JPG ou WebP.`,
    );
  }

  return {
    nome: anexo.nome,
    mimeType: anexo.mimeType,
    tamanhoBytes: bytes.length,
    conteudo: anexo.conteudo,
  };
}
