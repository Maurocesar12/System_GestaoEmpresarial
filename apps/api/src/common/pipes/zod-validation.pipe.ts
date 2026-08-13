import { BadRequestException, Injectable, type PipeTransform } from '@nestjs/common';
import { CODIGOS_ERRO, type ApiError } from '@gestao/shared-types';
import type { ZodType } from 'zod';

/**
 * Valida o corpo/query/param da requisição contra um schema Zod.
 *
 * A validação usa os mesmos schemas de `@gestao/shared-types` que o frontend
 * usa no React Hook Form — uma regra escrita uma vez só. Divergência entre o
 * que o formulário aceita e o que a API aceita deixa de ser possível.
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

    if (resultado.success) {
      return resultado.data;
    }

    // Agrupa por campo: o frontend precisa saber qual input pintar de vermelho.
    const detalhes: Record<string, string[]> = {};
    for (const issue of resultado.error.issues) {
      const campo = issue.path.join('.') || '_';
      (detalhes[campo] ??= []).push(issue.message);
    }

    const erro: ApiError = {
      codigo: CODIGOS_ERRO.VALIDACAO,
      mensagem: 'Dados inválidos.',
      detalhes,
    };

    throw new BadRequestException(erro);
  }
}
