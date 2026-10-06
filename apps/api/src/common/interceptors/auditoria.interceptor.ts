import {
  Injectable,
  Logger,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { mergeMap, type Observable } from 'rxjs';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { obterContextoTenant } from '../../infra/tenant/tenant-context';
import { AuditoriaService } from '../../modules/plataforma/auditoria/auditoria.service';

const CONTROLADORES_COM_AUDITORIA_TRANSACIONAL = new Set([
  'ClientesController',
  'FunilController',
  'FinanceiroController',
  'EquipeController',
  'ConfiguracoesController',
  'LgpdController',
  'EstoqueController',
  'ComissoesController',
]);

/**
 * O histórico não registra o que se faz com o próprio histórico.
 *
 * Excluir registros é ação de `admin` (veja `PapeisGuard`), e anotar cada
 * exclusão recolocaria na lista o volume que o administrador acabou de tirar.
 * O `AuditoriaService.removerVarios` segue a mesma regra — se um dos dois
 * mudar sozinho, a linha volta por um caminho que ninguém procura.
 */
const CONTROLADORES_SEM_TRILHA = new Set(['AuditoriaController']);

/** Completa a trilha dos módulos antigos que ainda não gravam dentro da transação. */
@Injectable()
export class AuditoriaInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditoriaInterceptor.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  intercept(contextoExecucao: ExecutionContext, proximo: CallHandler): Observable<unknown> {
    const req = contextoExecucao.switchToHttp().getRequest<Request>();
    const metodo = req.method;
    const controlador = contextoExecucao.getClass().name;
    const contexto = obterContextoTenant();
    const mutacao = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(metodo);

    if (
      !contexto ||
      !mutacao ||
      CONTROLADORES_COM_AUDITORIA_TRANSACIONAL.has(controlador) ||
      CONTROLADORES_SEM_TRILHA.has(controlador)
    ) {
      return proximo.handle();
    }

    return proximo.handle().pipe(
      mergeMap(async (resposta: unknown) => {
        try {
          const corpo = req.body as Record<string, unknown> | undefined;
          const respostaId =
            typeof resposta === 'object' && resposta && 'id' in resposta
              ? String(resposta.id)
              : undefined;
          const parametroBruto = req.params.id ?? req.params.clienteId;
          const parametroId = typeof parametroBruto === 'string' ? parametroBruto : undefined;
          const corpoId =
            corpo && typeof corpo.clienteId === 'string' ? corpo.clienteId : undefined;
          const entidadeId = respostaId ?? parametroId ?? corpoId ?? contexto.requestId;
          await this.prisma.comTenant((tx) =>
            this.auditoria.registrar(tx, {
              entidade: controlador.replace(/Controller$/, '').toLowerCase(),
              entidadeId,
              acao:
                metodo === 'DELETE'
                  ? 'excluiu'
                  : req.path.includes('mover')
                    ? 'movimentou'
                    : metodo === 'POST' &&
                        !req.path.includes('status') &&
                        !req.path.includes('cancelar')
                      ? 'criou'
                      : 'alterou',
              depois: corpo ? this.removerSegredos(corpo) : undefined,
            }),
          );
        } catch (erro) {
          this.logger.error(`Não foi possível registrar auditoria de ${metodo} ${req.path}`, erro);
        }
        return resposta;
      }),
    );
  }

  /**
   * Tira credenciais do corpo antes de gravar na trilha, em qualquer nível.
   *
   * O histórico é lido por quem tem `auditoria.visualizar`, que não precisa ser
   * administrador: um segredo aninhado (`{ acesso: { senha } }`) ou com outro
   * nome (`chave`, `secret`) não pode passar só por não estar no primeiro nível.
   */
  private removerSegredos(corpo: Record<string, unknown>): Record<string, unknown> {
    const SEGREDO = /senha|token|chave|secret|password|api[_-]?key|authorization/i;

    const limpar = (valor: unknown): unknown => {
      if (Array.isArray(valor)) return valor.map(limpar);
      if (typeof valor !== 'object' || valor === null) return valor;

      return Object.fromEntries(
        Object.entries(valor)
          .filter(([chave]) => !SEGREDO.test(chave))
          .map(([chave, item]) => [chave, limpar(item)]),
      );
    };

    return limpar(corpo) as Record<string, unknown>;
  }
}
