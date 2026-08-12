import { BadRequestException } from '@nestjs/common';
import { CODIGOS_ERRO, loginSchema, signupSchema, type ApiError } from '@gestao/shared-types';
import { ZodValidationPipe } from './zod-validation.pipe';

describe('ZodValidationPipe', () => {
  it('devolve os dados já validados e normalizados', () => {
    const pipe = new ZodValidationPipe(loginSchema);

    const resultado = pipe.transform({ email: '  Joao@Empresa.COM ', senha: 'segredo' });

    // Normalização importa: o cadastro grava o e-mail em minúsculas, e sem isso
    // o login falharia por diferença de caixa.
    expect(resultado).toEqual({ email: 'joao@empresa.com', senha: 'segredo' });
  });

  it('lança erro no formato ApiError, agrupado por campo', () => {
    const pipe = new ZodValidationPipe(signupSchema);

    let capturado: ApiError | undefined;
    try {
      pipe.transform({ nomeEmpresa: 'X', nomeResponsavel: '', email: 'nao-e-email', senha: '123' });
    } catch (erro) {
      expect(erro).toBeInstanceOf(BadRequestException);
      capturado = (erro as BadRequestException).getResponse() as ApiError;
    }

    expect(capturado?.codigo).toBe(CODIGOS_ERRO.VALIDACAO);
    // Todos os campos inválidos de uma vez: o formulário precisa pintar tudo
    // que está errado, não só o primeiro campo.
    expect(Object.keys(capturado?.detalhes ?? {}).sort()).toEqual([
      'email',
      'nomeEmpresa',
      'nomeResponsavel',
      'senha',
    ]);
  });

  it('rejeita campo desconhecido em vez de repassá-lo adiante', () => {
    const pipe = new ZodValidationPipe(loginSchema);

    const resultado = pipe.transform({
      email: 'joao@empresa.com',
      senha: 'segredo',
      papel: 'admin',
    });

    // Escalada de privilégio por campo extra no corpo é um clássico: o schema
    // não declara `papel`, então ele não pode sobreviver à validação.
    expect(resultado).not.toHaveProperty('papel');
  });
});
