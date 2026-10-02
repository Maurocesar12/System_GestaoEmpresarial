import { BadRequestException } from '@nestjs/common';
import type { AnexoLancamentoInput } from '@gestao/shared-types';
import { conferirAnexo } from './conferencia-anexo';

const comoDataUrl = (tipo: string, bytes: Buffer) =>
  `data:${tipo};base64,${bytes.toString('base64')}`;

const PDF = Buffer.from('%PDF-1.7\n%conteúdo de teste\n', 'latin1');
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const HTML = Buffer.from('<html><script>alert(1)</script></html>');

function anexo(parcial: Partial<AnexoLancamentoInput>): AnexoLancamentoInput {
  return {
    nome: 'nota.pdf',
    mimeType: 'application/pdf',
    tamanhoBytes: 10,
    conteudo: comoDataUrl('application/pdf', PDF),
    ...parcial,
  };
}

describe('conferirAnexo', () => {
  it('aceita um PDF de verdade e mede o tamanho pelos bytes', () => {
    // O tamanho declarado (10) é ignorado: vale o que o servidor contou.
    expect(conferirAnexo(anexo({}), 0).tamanhoBytes).toBe(PDF.length);
  });

  it('aceita um PNG de verdade', () => {
    const resultado = conferirAnexo(
      anexo({ nome: 'foto.png', mimeType: 'image/png', conteudo: comoDataUrl('image/png', PNG) }),
      0,
    );

    expect(resultado.mimeType).toBe('image/png');
  });

  it('recusa HTML disfarçado de PDF', () => {
    expect(() =>
      conferirAnexo(anexo({ conteudo: comoDataUrl('application/pdf', HTML) }), 0),
    ).toThrow(BadRequestException);
  });

  it('recusa quando o prefixo diz um tipo e o mimeType diz outro', () => {
    expect(() =>
      conferirAnexo(
        anexo({ mimeType: 'image/png', conteudo: comoDataUrl('application/pdf', PDF) }),
        0,
      ),
    ).toThrow(BadRequestException);
  });

  it('aponta o campo do anexo recusado, para a tela marcar o certo', () => {
    try {
      conferirAnexo(anexo({ conteudo: comoDataUrl('application/pdf', HTML) }), 2);
      throw new Error('deveria ter recusado');
    } catch (erro) {
      const corpo = (erro as BadRequestException).getResponse() as { detalhes: object };
      expect(Object.keys(corpo.detalhes)).toEqual(['anexos.2.conteudo']);
    }
  });
});
