import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ExceptionFilter,
} from '@nestjs/common';
import { CODIGOS_ERRO, type ApiError, type CodigoErro } from '@gestao/shared-types';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

/** Traduz o status HTTP para o código estável que o frontend consome. */
const CODIGO_POR_STATUS: Partial<Record<HttpStatus, CodigoErro>> = {
  [HttpStatus.BAD_REQUEST]: CODIGOS_ERRO.VALIDACAO,
  [HttpStatus.UNAUTHORIZED]: CODIGOS_ERRO.NAO_AUTENTICADO,
  [HttpStatus.FORBIDDEN]: CODIGOS_ERRO.SEM_PERMISSAO,
  [HttpStatus.NOT_FOUND]: CODIGOS_ERRO.NAO_ENCONTRADO,
  [HttpStatus.CONFLICT]: CODIGOS_ERRO.CONFLITO,
  [HttpStatus.PAYMENT_REQUIRED]: CODIGOS_ERRO.TENANT_SUSPENSO,
  [HttpStatus.TOO_MANY_REQUESTS]: CODIGOS_ERRO.MUITAS_REQUISICOES,
};

/**
 * Limiar de erro de servidor. Tipado como `number` porque `getStatus()` devolve
 * `number`, e comparar `number` com membro de enum é erro de tipo.
 */
const STATUS_ERRO_SERVIDOR: number = HttpStatus.INTERNAL_SERVER_ERROR;

/**
 * Converte qualquer exceção no formato único de erro da API.
 *
 * Erro 5xx nunca devolve a mensagem original: stack trace e texto de exceção do
 * banco vazam estrutura interna. O detalhe fica no log, correlacionado ao
 * cliente por `requestId`.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = randomUUID();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const corpo: ApiError =
      status >= STATUS_ERRO_SERVIDOR
        ? {
            codigo: CODIGOS_ERRO.ERRO_INTERNO,
            mensagem: 'Erro interno. Tente novamente em instantes.',
            requestId,
          }
        : { ...this.extrairErro(exception, status), requestId };

    if (status >= STATUS_ERRO_SERVIDOR) {
      this.logger.error(
        `[${requestId}] ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json(corpo);
  }

  /**
   * Preserva o `ApiError` quando a exceção já foi lançada nesse formato
   * (é o caso do ZodValidationPipe); caso contrário, monta um a partir do
   * status e da mensagem.
   */
  private extrairErro(exception: unknown, status: HttpStatus): ApiError {
    const padrao: ApiError = {
      codigo: CODIGO_POR_STATUS[status] ?? CODIGOS_ERRO.ERRO_INTERNO,
      mensagem: 'Requisição inválida.',
    };

    if (!(exception instanceof HttpException)) {
      return padrao;
    }

    const resposta = exception.getResponse();

    if (typeof resposta === 'string') {
      return { ...padrao, mensagem: resposta };
    }

    if (typeof resposta === 'object' && resposta !== null) {
      const candidato = resposta as Partial<ApiError> & { message?: string | string[] };

      if (typeof candidato.codigo === 'string' && typeof candidato.mensagem === 'string') {
        return candidato as ApiError;
      }

      const mensagem = Array.isArray(candidato.message)
        ? candidato.message.join('; ')
        : candidato.message;

      return { ...padrao, mensagem: mensagem ?? padrao.mensagem };
    }

    return padrao;
  }
}
