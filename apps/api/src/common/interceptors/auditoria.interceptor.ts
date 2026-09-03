import { Injectable, Logger, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import type { Request } from 'express';
import { mergeMap, type Observable } from 'rxjs';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { obterContextoTenant } from '../../infra/tenant/tenant-context';
import { AuditoriaService } from '../../modules/plataforma/auditoria/auditoria.service';

const CONTROLADORES_COM_AUDITORIA_TRANSACIONAL = new Set([
  'ClientesController', 'FunilController', 'FinanceiroController',
  'EquipeController', 'ConfiguracoesController',
]);

/** Completa a trilha dos módulos antigos que ainda não gravam dentro da transação. */
@Injectable()
export class AuditoriaInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditoriaInterceptor.name);
  constructor(private readonly prisma: PrismaService, private readonly auditoria: AuditoriaService) {}

  intercept(contextoExecucao: ExecutionContext, proximo: CallHandler): Observable<unknown> {
    const req = contextoExecucao.switchToHttp().getRequest<Request>();
    const metodo = req.method;
    const controlador = contextoExecucao.getClass().name;
    const contexto = obterContextoTenant();
    const mutacao = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(metodo);

    if (!contexto || !mutacao || CONTROLADORES_COM_AUDITORIA_TRANSACIONAL.has(controlador)) {
      return proximo.handle();
    }

    return proximo.handle().pipe(mergeMap(async (resposta: unknown) => {
      try {
        const corpo = req.body as Record<string, unknown> | undefined;
        const respostaId =
          typeof resposta === 'object' && resposta && 'id' in resposta
            ? String(resposta.id)
            : undefined;
        const parametroBruto = req.params.id ?? req.params.clienteId;
        const parametroId = typeof parametroBruto === 'string' ? parametroBruto : undefined;
        const corpoId = corpo && typeof corpo.clienteId === 'string' ? corpo.clienteId : undefined;
        const entidadeId = respostaId ?? parametroId ?? corpoId ?? contexto.requestId;
        await this.prisma.comTenant((tx) => this.auditoria.registrar(tx, {
          entidade: controlador.replace(/Controller$/, '').toLowerCase(),
          entidadeId,
          acao: metodo === 'DELETE' ? 'excluiu' : req.path.includes('mover') ? 'movimentou' : metodo === 'POST' && !req.path.includes('status') && !req.path.includes('cancelar') ? 'criou' : 'alterou',
          depois: corpo ? this.removerSegredos(corpo) : undefined,
        }));
      } catch (erro) {
        this.logger.error(`Não foi possível registrar auditoria de ${metodo} ${req.path}`, erro);
      }
      return resposta;
    }));
  }

  private removerSegredos(corpo: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(Object.entries(corpo).filter(([chave]) => !/senha|token/i.test(chave)));
  }
}
