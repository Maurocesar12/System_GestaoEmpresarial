import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';
import { procurarCodigo } from './codigo-injetado';

const campos = (valor: unknown) => procurarCodigo(valor).map((achado) => achado.campo);

describe('procurarCodigo', () => {
  it.each([
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    'Oi <b>negrito</b>',
    '<svg/onload=alert(1)',
    '<iframe src="https://mal.com"',
    '<!-- comentário -->',
    '<?php system($_GET["c"]); ?>',
    'javascript:alert(1)',
    'JaVaScRiPt :alert(1)',
    'data:text/html;base64,PHNjcmlwdD4=',
    '=HYPERLINK("http://mal.com","clique")',
    "=cmd|' /C calc'!A0",
    'fatura\u202efdp.exe',
    'texto\u0000com nulo',
  ])('recusa %p', (texto) => {
    expect(campos({ descricao: texto })).toEqual(['descricao']);
  });

  it.each([
    'Pagamento de 50% < 100 reais',
    'Fulano <fulano@empresa.com>',
    'Serviço de manutenção — R$ 1.200,00',
    '+55 (11) 98765-4321',
    '-10% de desconto',
    '@instagram_da_empresa',
    'Linha 1\nLinha 2\tcom tab',
    'C++ e C#',
    'a => b',
    'Rua das Flores, 123 — fundos',
  ])('aceita texto comum: %p', (texto) => {
    expect(campos({ descricao: texto })).toEqual([]);
  });

  it('aponta o caminho exato, inclusive dentro de listas', () => {
    const corpo = {
      clientes: [{ nome: 'Ana' }, { nome: 'Bruno', obs: '<script>' }],
    };
    expect(campos(corpo)).toEqual(['clientes.1.obs']);
  });

  it('confere também o nome das chaves (campos personalizados)', () => {
    expect(campos({ camposPersonalizados: { '<b>x</b>': 'valor' } })).toEqual([
      'camposPersonalizados.<b>x</b>',
    ]);
  });

  it('não mexe em senha, token e anexo em base64', () => {
    expect(
      campos({
        senha: '<minha>senha=forte',
        novaSenha: '=<script>',
        refreshToken: 'abc.def',
        desafio: 'x.y.z',
        anexos: [{ conteudo: 'data:application/pdf;base64,JVBERi0xLjQK' }],
      }),
    ).toEqual([]);
  });

  it('recusa estrutura aninhada demais', () => {
    let fundo: unknown = 'x';
    for (let nivel = 0; nivel < 40; nivel++) fundo = { a: fundo };
    expect(procurarCodigo(fundo)).not.toHaveLength(0);
  });
});

describe('ZodValidationPipe com a trava de código', () => {
  const pipe = new ZodValidationPipe(z.object({ nome: z.string(), obs: z.string().optional() }));

  it('deixa passar dados comuns', () => {
    expect(pipe.transform({ nome: 'Ana', obs: 'Cliente desde 2020' })).toEqual({
      nome: 'Ana',
      obs: 'Cliente desde 2020',
    });
  });

  it('responde 400 de validação com o campo exato', () => {
    try {
      pipe.transform({ nome: 'Ana', obs: '<script>alert(1)</script>' });
      throw new Error('deveria ter recusado');
    } catch (erro) {
      expect(erro).toBeInstanceOf(BadRequestException);
      const corpo = (erro as BadRequestException).getResponse() as {
        codigo: string;
        detalhes: Record<string, string[]>;
      };
      expect(corpo.codigo).toBe('VALIDACAO');
      expect(Object.keys(corpo.detalhes)).toEqual(['obs']);
    }
  });
});
