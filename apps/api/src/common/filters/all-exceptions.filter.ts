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
 * Erros do Prisma que são consequência de concorrência ou de dado inválido, e
 * não defeito do servidor. Sem esta tabela todos viravam 500, e quem perdia uma
 * corrida lia "Erro interno" em vez de saber que era só tentar de novo.
 *
 * Reconhecidos pelo `code` (e não por `instanceof`), como no resto da API, para
 * não depender de qual cópia do runtime do Prisma lançou o erro.
 */
const ERROS_PRISMA: Record<string, { status: HttpStatus; erro: ApiError }> = {
  // Unique violada: o duplicado que a checagem prévia não viu a tempo.
  P2002: {
    status: HttpStatus.CONFLICT,
    erro: {
      codigo: CODIGOS_ERRO.CONFLITO,
      mensagem: 'Já existe um registro com esses dados. Atualize a tela e confira.',
    },
  },
  // Chave estrangeira: o registro apontado foi removido (ou passou a ser usado) no meio.
  P2003: {
    status: HttpStatus.CONFLICT,
    erro: {
      codigo: CODIGOS_ERRO.CONFLITO,
      mensagem:
        'Este registro está ligado a outro que mudou agora há pouco. Atualize a tela e tente de novo.',
    },
  },
  // Update/delete em linha que não existe mais.
  P2025: {
    status: HttpStatus.NOT_FOUND,
    erro: {
      codigo: CODIGOS_ERRO.NAO_ENCONTRADO,
      mensagem: 'Registro não encontrado. Ele pode ter sido removido por outra pessoa.',
    },
  },
  // Deadlock ou conflito de escrita: o banco desfez a transação; repetir resolve.
  P2034: {
    status: HttpStatus.SERVICE_UNAVAILABLE,
    erro: {
      codigo: CODIGOS_ERRO.ERRO_INTERNO,
      mensagem: 'O sistema está ocupado. Tente novamente em instantes.',
    },
  },
  // A transação esperou demais por conexão ou por lock.
  P2028: {
    status: HttpStatus.SERVICE_UNAVAILABLE,
    erro: {
      codigo: CODIGOS_ERRO.ERRO_INTERNO,
      mensagem: 'O sistema está ocupado. Tente novamente em instantes.',
    },
  },
};

function erroPrismaConhecido(exception: unknown): (typeof ERROS_PRISMA)[string] | undefined {
  if (typeof exception !== 'object' || exception === null || !('code' in exception)) {
    return undefined;
  }

  return typeof exception.code === 'string' ? ERROS_PRISMA[exception.code] : undefined;
}

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

    const prisma = exception instanceof HttpException ? undefined : erroPrismaConhecido(exception);

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : (prisma?.status ?? HttpStatus.INTERNAL_SERVER_ERROR);

    // Erro 5xx genérico não devolve a mensagem original; o do Prisma já tem
    // texto próprio, escrito para o usuário, e por isso é o único que passa.
    const corpo: ApiError = prisma
      ? { ...prisma.erro, requestId }
      : status >= STATUS_ERRO_SERVIDOR
        ? {
            codigo: CODIGOS_ERRO.ERRO_INTERNO,
            mensagem: 'Erro interno. Tente novamente em instantes.',
            requestId,
          }
        : { ...this.extrairErro(exception, status), requestId };

    if (prisma && status < STATUS_ERRO_SERVIDOR) {
      // Continua rastreável: antes era um erro 500 com stack, agora seria mudo.
      this.logger.warn(
        `[${requestId}] ${request.method} ${request.url} — Prisma ${(exception as { code: string }).code}`,
      );
    }

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
