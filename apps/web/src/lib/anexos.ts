import {
  MAX_BYTES_ANEXO_LANCAMENTO,
  MIME_TYPES_ANEXO_LANCAMENTO,
  type AnexoLancamentoInput,
} from '@gestao/shared-types';

/**
 * Preparo dos anexos do lançamento, no navegador.
 *
 * O anexo viaja embutido no JSON do formulário, em base64. Isso mantém o
 * sistema sem serviço de arquivos — decisão de arquitetura — mas cobra o preço
 * de 4/3 do tamanho em cada envio. Daí este arquivo: reduzir a foto **antes**
 * de ela virar base64 é o que faz a diferença entre um envio de 4 MB e um de
 * 300 kB, e é o mesmo motivo de a tela voltar a responder rápido depois.
 *
 * Foto de celular é o caso comum: nota fiscal fotografada sai com 3 a 6 MB e
 * 4000 px de largura, quando 1600 px já lê melhor do que o olho precisa num
 * comprovante. Antes disso, esse arquivo simplesmente era recusado por passar
 * de 2 MB, e a pessoa tinha que descobrir sozinha como diminuir.
 */

type MimeAnexo = (typeof MIME_TYPES_ANEXO_LANCAMENTO)[number];

/** Lado maior, em pixels, de uma imagem anexada. Texto de nota continua legível. */
const LADO_MAXIMO = 1600;

/** WebP a 82% mantém texto de nota nítido e costuma cortar mais de 80% do peso. */
const QUALIDADE_WEBP = 0.82;

const EXTENSAO_PARA_MIME: Record<string, MimeAnexo> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

/** Extensões oferecidas ao seletor de arquivos do sistema. */
export const EXTENSOES_ANEXO = '.pdf,.png,.jpg,.jpeg,.webp';

export interface AnexoPreparado {
  anexo: AnexoLancamentoInput;
  /** Tamanho original, quando a imagem foi reduzida. Alimenta o aviso na tela. */
  bytesOriginais?: number;
}

/** Falha de um arquivo específico — a tela mostra uma linha por arquivo. */
export class ErroDeAnexo extends Error {
  constructor(
    readonly arquivo: string,
    mensagem: string,
  ) {
    super(mensagem);
    this.name = 'ErroDeAnexo';
  }
}

export function formatarTamanho(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

/**
 * Tipo do arquivo, pelo que o navegador declara ou pela extensão.
 *
 * A extensão é o plano B porque o `type` vem vazio em algumas origens — de
 * gerenciadores de arquivos do Android a arquivos arrastados de um zip.
 */
function mimeDoArquivo(arquivo: File): MimeAnexo | null {
  if ((MIME_TYPES_ANEXO_LANCAMENTO as readonly string[]).includes(arquivo.type)) {
    return arquivo.type as MimeAnexo;
  }

  const extensao = arquivo.name.split('.').pop()?.toLowerCase() ?? '';

  return EXTENSAO_PARA_MIME[extensao] ?? null;
}

function lerComoDataUrl(blob: Blob, arquivo: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result));
    leitor.onerror = () => reject(new ErroDeAnexo(arquivo, 'Não foi possível ler o arquivo.'));
    leitor.readAsDataURL(blob);
  });
}

/**
 * Reduz uma imagem para, no máximo, {@link LADO_MAXIMO} no lado maior.
 *
 * Usa `createImageBitmap`, que decodifica fora da thread principal — com
 * `<img>` + `onload`, uma foto de 12 megapixels trava a interface por um
 * instante bem visível. Devolve `null` quando o navegador não dá conta ou
 * quando o resultado ficaria maior que o original (imagem já otimizada,
 * PNG pequeno de captura de tela): nesses casos o arquivo original é melhor.
 */
async function reduzirImagem(arquivo: File): Promise<Blob | null> {
  if (typeof createImageBitmap !== 'function') return null;

  let bitmap: ImageBitmap | undefined;

  try {
    bitmap = await createImageBitmap(arquivo);

    const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height));
    const largura = Math.round(bitmap.width * escala);
    const altura = Math.round(bitmap.height * escala);

    const tela = document.createElement('canvas');
    tela.width = largura;
    tela.height = altura;

    const contexto = tela.getContext('2d');
    if (!contexto) return null;

    contexto.drawImage(bitmap, 0, 0, largura, altura);

    const reduzida = await new Promise<Blob | null>((resolve) => {
      tela.toBlob(resolve, 'image/webp', QUALIDADE_WEBP);
    });

    return reduzida && reduzida.size < arquivo.size ? reduzida : null;
  } catch {
    // Imagem corrompida ou formato que o navegador não decodifica: segue com o
    // original, que ainda pode passar pelo limite de tamanho.
    return null;
  } finally {
    bitmap?.close();
  }
}

/** Troca a extensão do nome ao converter para WebP, para o download bater com o conteúdo. */
function nomeWebp(nome: string): string {
  return `${nome.replace(/\.[^.]+$/, '')}.webp`;
}

/**
 * Transforma um arquivo escolhido em anexo pronto para enviar.
 *
 * Lança {@link ErroDeAnexo} com mensagem já escrita para o usuário — quem
 * chama só precisa exibir, sem traduzir código de erro.
 */
export async function prepararAnexo(arquivo: File): Promise<AnexoPreparado> {
  const mimeType = mimeDoArquivo(arquivo);

  if (!mimeType) {
    throw new ErroDeAnexo(arquivo.name, 'Formato não aceito. Envie PDF, PNG, JPG ou WebP.');
  }

  if (arquivo.size === 0) {
    throw new ErroDeAnexo(arquivo.name, 'O arquivo está vazio.');
  }

  const reduzida = mimeType === 'application/pdf' ? null : await reduzirImagem(arquivo);
  const conteudoFinal = reduzida ?? arquivo;

  if (conteudoFinal.size > MAX_BYTES_ANEXO_LANCAMENTO) {
    throw new ErroDeAnexo(
      arquivo.name,
      `Tem ${formatarTamanho(conteudoFinal.size)} e o limite é ${formatarTamanho(MAX_BYTES_ANEXO_LANCAMENTO)}.`,
    );
  }

  const tipoFinal: MimeAnexo = reduzida ? 'image/webp' : mimeType;

  return {
    anexo: {
      nome: reduzida ? nomeWebp(arquivo.name) : arquivo.name,
      mimeType: tipoFinal,
      tamanhoBytes: conteudoFinal.size,
      // O `Blob` recriado garante o `type` correto no data URL: arquivo vindo
      // sem `type` produziria `data:application/octet-stream`, que o schema
      // recusa mesmo o conteúdo estando certo.
      conteudo: await lerComoDataUrl(new Blob([conteudoFinal], { type: tipoFinal }), arquivo.name),
    },
    bytesOriginais: reduzida ? arquivo.size : undefined,
  };
}
