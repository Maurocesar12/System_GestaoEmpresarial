import { BadRequestException, Injectable, type PipeTransform } from '@nestjs/common';
import { CODIGOS_ERRO, type ApiError } from '@gestao/shared-types';
import type { ZodType } from 'zod';
import { procurarCodigo } from '../seguranca/codigo-injetado';

/**
 * Valida o corpo/query da requisição contra um schema Zod e recusa código
 * dentro dos dados.
 *
 * Duas etapas, nesta ordem: o schema de `@gestao/shared-types` (formato,
 * tamanho, tipo) e depois a busca por HTML, script, fórmula e caracteres de
 * controle em todo texto — veja `procurarCodigo`. As duas respondem no mesmo
 * formato, com o campo exato, para a tela marcar o input certo.
 *
 * Uso:
 * ```ts
 * @Post('login')
 * login(@Body(new ZodValidationPipe(loginSchema)) dados: LoginInput) {}
 * ```
 */
@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  /**
   * O segundo parâmetro de `ZodType` é o tipo de **entrada**, deixado como
   * `unknown` de propósito.
   *
   * Vários schemas do projeto transformam os dados — a query de paginação
   * converte texto em número, o formulário de cliente converte campo vazio em
   * `null`. Neles, entrada e saída são tipos diferentes, e um `ZodType<T>` sem
   * o segundo parâmetro não casa: o TypeScript desiste e infere `any`,
   * apagando a tipagem de tudo que passa pelo pipe.
   */
  constructor(private readonly schema: ZodType<T, unknown>) {}

  transform(valor: unknown): T {
    const resultado = this.schema.safeParse(valor);

    if (!resultado.success) {
      // Agrupa por campo: o frontend precisa saber qual input pintar de vermelho.
      const detalhes: Record<string, string[]> = {};
      for (const issue of resultado.error.issues) {
        const campo = issue.path.join('.') || '_';
        (detalhes[campo] ??= []).push(issue.message);
      }
      throw this.invalido('Dados inválidos.', detalhes);
    }

    const achados = procurarCodigo(resultado.data);
    if (achados.length > 0) {
      const detalhes: Record<string, string[]> = {};
      for (const { campo, mensagem } of achados) (detalhes[campo] ??= []).push(mensagem);
      throw this.invalido('Há código ou marcação em um dos campos.', detalhes);
    }

    return resultado.data;
  }

  private invalido(mensagem: string, detalhes: Record<string, string[]>): BadRequestException {
    const erro: ApiError = { codigo: CODIGOS_ERRO.VALIDACAO, mensagem, detalhes };
    return new BadRequestException(erro);
  }
}
