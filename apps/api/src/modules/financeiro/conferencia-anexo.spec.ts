import { BadRequestException } from '@nestjs/common';
import type { AnexoLancamentoInput } from '@gestao/shared-types';
import { crc32 } from 'node:zlib';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';
import { conferirAnexo, nomeSeguro } from './conferencia-anexo';

const comoDataUrl = (tipo: string, bytes: Buffer | Uint8Array) =>
  `data:${tipo};base64,${Buffer.from(bytes).toString('base64')}`;

const HTML = Buffer.from('<html><script>alert(1)</script></html>');

function anexo(parcial: Partial<AnexoLancamentoInput>): AnexoLancamentoInput {
  return {
    nome: 'nota.pdf',
    mimeType: 'application/pdf',
    tamanhoBytes: 10,
    conteudo: '',
    ...parcial,
  };
}

async function pdf(montar?: (documento: PDFDocument) => void | Promise<void>): Promise<Buffer> {
  const documento = await PDFDocument.create();
  documento.addPage([200, 200]).drawText('Nota fiscal', { x: 20, y: 100, size: 12 });
  await montar?.(documento);
  // `useObjectStreams` (padrão) compacta os objetos: o JavaScript não aparece
  // em texto no arquivo, e a conferência precisa achá-lo mesmo assim.
  return Buffer.from(await documento.save({ useObjectStreams: true }));
}

const anexoPdf = async (bytes: Buffer, nome = 'nota.pdf') =>
  conferirAnexo(anexo({ nome, conteudo: comoDataUrl('application/pdf', bytes) }), 0);

async function imagem(formato: 'png' | 'jpeg'): Promise<Buffer> {
  const base = sharp({
    create: { width: 16, height: 16, channels: 3, background: { r: 200, g: 50, b: 50 } },
  });
  return formato === 'png' ? base.png().toBuffer() : base.jpeg().toBuffer();
}

/** Um PNG cujo cabeçalho diz 50.000 × 50.000 pixels, com quase nada de dados. */
function pngGigante(): Buffer {
  const pedaco = (tipo: string, dados: Buffer) => {
    const corpo = Buffer.concat([Buffer.from(tipo, 'latin1'), dados]);
    const tamanho = Buffer.alloc(4);
    tamanho.writeUInt32BE(dados.length);
    const verificacao = Buffer.alloc(4);
    verificacao.writeUInt32BE(crc32(corpo));
    return Buffer.concat([tamanho, corpo, verificacao]);
  };
  const cabecalho = Buffer.alloc(13);
  cabecalho.writeUInt32BE(50_000, 0);
  cabecalho.writeUInt32BE(50_000, 4);
  cabecalho.set([8, 2, 0, 0, 0], 8);

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pedaco('IHDR', cabecalho),
    pedaco('IDAT', Buffer.from([0x78, 0x9c, 0x03, 0x00, 0x00, 0x00, 0x00, 0x01])),
    pedaco('IEND', Buffer.alloc(0)),
  ]);
}

async function recusaCom(promessa: Promise<unknown>, trecho: string): Promise<void> {
  await expect(promessa).rejects.toBeInstanceOf(BadRequestException);
  await promessa.catch((erro: BadRequestException) => {
    const corpo = erro.getResponse() as { mensagem: string };
    expect(corpo.mensagem).toContain(trecho);
  });
}

describe('conferirAnexo', () => {
  describe('PDF', () => {
    it('aceita um PDF comum e mede o tamanho pelos bytes', async () => {
      const bytes = await pdf();
      // O tamanho declarado (10) é ignorado: vale o que o servidor contou.
      expect((await anexoPdf(bytes)).tamanhoBytes).toBe(bytes.length);
    });

    it('recusa PDF com JavaScript, mesmo compactado dentro de object stream', async () => {
      const bytes = await pdf((documento) => {
        documento.addJavaScript('ataque', 'app.alert("invadido")');
      });
      expect(bytes.toString('latin1')).not.toContain('/JavaScript');

      await recusaCom(anexoPdf(bytes), 'scripts');
    });

    it('recusa PDF com arquivo embutido', async () => {
      const bytes = await pdf(async (documento) => {
        await documento.attach(Buffer.from('MZ executável'), 'programa.exe', {
          mimeType: 'application/octet-stream',
        });
      });

      await recusaCom(anexoPdf(bytes), 'arquivos embutidos');
    });

    it('recusa PDF protegido por senha, que não dá para inspecionar', async () => {
      const criptografado = Buffer.from(
        '%PDF-1.4\n' +
          '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n' +
          '2 0 obj << /Type /Pages /Kids [] /Count 0 >> endobj\n' +
          '3 0 obj << /Filter /Standard /V 1 /R 2 /O (x) /U (y) /P -4 >> endobj\n' +
          'trailer << /Root 1 0 R /Encrypt 3 0 R >>\n%%EOF\n',
        'latin1',
      );

      await recusaCom(anexoPdf(criptografado), 'senha');
    });

    it('recusa HTML disfarçado de PDF', async () => {
      await recusaCom(anexoPdf(HTML), 'não é um PDF válido');
    });
  });

  describe('imagem', () => {
    it('recodifica a imagem: o que foi colado depois dos pixels some', async () => {
      // Arquivo "poliglota": PNG válido com HTML grudado no fim.
      const poliglota = Buffer.concat([await imagem('png'), HTML]);

      const conferido = await conferirAnexo(
        anexo({
          nome: 'foto.png',
          mimeType: 'image/png',
          conteudo: comoDataUrl('image/png', poliglota),
        }),
        0,
      );
      const salvo = Buffer.from(conferido.conteudo.split(',')[1]!, 'base64');

      expect(salvo.toString('latin1')).not.toContain('<script>');
      expect(conferido.tamanhoBytes).toBe(salvo.length);
      expect((await sharp(salvo).metadata()).format).toBe('png');
    });

    it('descarta os metadados da foto (como a localização)', async () => {
      const comMetadados = await sharp(await imagem('jpeg'))
        .withExif({ IFD0: { Copyright: 'dado-privado', ImageDescription: 'rua tal, 123' } })
        .jpeg()
        .toBuffer();
      expect((await sharp(comMetadados).metadata()).exif).toBeDefined();

      const conferido = await conferirAnexo(
        anexo({
          nome: 'foto.jpg',
          mimeType: 'image/jpeg',
          conteudo: comoDataUrl('image/jpeg', comMetadados),
        }),
        0,
      );
      const salvo = Buffer.from(conferido.conteudo.split(',')[1]!, 'base64');

      expect((await sharp(salvo).metadata()).exif).toBeUndefined();
    });

    it('recusa imagem que declara dimensões absurdas (bomba de descompressão)', async () => {
      await recusaCom(
        conferirAnexo(
          anexo({
            nome: 'x.png',
            mimeType: 'image/png',
            conteudo: comoDataUrl('image/png', pngGigante()),
          }),
          0,
        ),
        'corrompida ou é grande demais',
      );
    });

    it('recusa JPG declarado como PNG', async () => {
      const jpeg = await imagem('jpeg');
      await expect(
        conferirAnexo(
          anexo({ nome: 'x.png', mimeType: 'image/png', conteudo: comoDataUrl('image/png', jpeg) }),
          0,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  it('recusa quando o prefixo diz um tipo e o mimeType diz outro', async () => {
    await expect(
      conferirAnexo(
        anexo({ mimeType: 'image/png', conteudo: comoDataUrl('application/pdf', await pdf()) }),
        0,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('aponta o campo do anexo recusado, para a tela marcar o certo', async () => {
    const erro = await conferirAnexo(
      anexo({ conteudo: comoDataUrl('application/pdf', HTML) }),
      2,
    ).catch((falha: BadRequestException) => falha);

    const corpo = (erro as BadRequestException).getResponse() as { detalhes: object };
    expect(Object.keys(corpo.detalhes)).toEqual(['anexos.2.conteudo']);
  });
});

describe('nomeSeguro', () => {
  it.each([
    ['nota.pdf', 'nota.pdf'],
    ['nota.pdf.exe', 'nota.pdf.pdf'],
    ['../../etc/passwd', 'etcpasswd.pdf'],
    ['C:\\Windows\\boleto.pdf', 'CWindowsboleto.pdf'],
    ['fatura\u202Efdp.exe', 'faturafdp.pdf'],
    ['<script>.pdf', 'script.pdf'],
    ['...', 'anexo.pdf'],
  ])('%p vira %p', (entrada, esperado) => {
    expect(nomeSeguro(entrada, 'application/pdf')).toBe(esperado);
  });
});
