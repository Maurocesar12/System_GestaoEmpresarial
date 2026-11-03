import { createHash } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  Logger,
  UnprocessableEntityException,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { CODIGOS_ERRO } from '@gestao/shared-types';
import type { Request, Response } from 'express';
import { catchError, from, mergeMap, of, throwError, type Observable } from 'rxjs';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { obterContextoTenant, type TenantContext } from '../../infra/tenant/tenant-context';
import { conflito } from '../erros';
import { uuidv7 } from '../uuid';

/** Quanto tempo a resposta de uma chave fica guardada para ser repetida. */
const VALIDADE_MS = 24 * 60 * 60 * 1000;

/**
 * Quanto tempo um pedido pode ficar "em andamento" antes de a chave ser
 * considerada abandonada (o processo caiu no meio). Passado esse prazo, um
 * novo envio assume a chave em vez de ficar recebendo 409 até a chave expirar.
 */
const ABANDONO_MS = 2 * 60 * 1000;

/** Respostas maiores que isto não são guardadas: a chave é liberada. */
const LIMITE_RESPOSTA = 256_000;

const FORMATO_CHAVE = /^[A-Za-z0-9_:.-]{8,128}$/;

type Decisao = { tipo: 'executar' } | { tipo: 'repetir'; resposta: unknown };

/**
 * `Idempotency-Key`: o mesmo pedido enviado duas vezes (duplo clique, retry de
 * rede, resposta que se perdeu no caminho) executa uma vez só.
 *
 * Quem quer a proteção manda o cabeçalho num POST autenticado. A primeira
 * chamada reivindica a chave (a unique do banco decide quem ganha quando duas
 * chegam juntas), executa e guarda a resposta; as seguintes, com a mesma chave e
 * o mesmo pedido, recebem a resposta guardada sem executar de novo.
 *
 * - **Mesma chave, pedido diferente** (outro caminho ou outro corpo): 422. Seria
 *   o erro de reaproveitar a chave, e repetir a resposta antiga mentiria.
 * - **Pedido ainda em andamento:** 409 — quem chegou juntos espera e tenta de novo.
 * - **Pedido que falhou:** a chave é liberada, e tentar de novo é permitido.
 * - **Sem o cabeçalho, ou upload (multipart):** passa direto, como sempre foi.
 *
 * Registrado antes do `AuditoriaInterceptor`, então uma repetição não passa
 * pela auditoria de novo: o registro dela já existe da primeira execução.
 */
@Injectable()
export class IdempotenciaInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotenciaInterceptor.name);

  constructor(private readonly prisma: PrismaService) {}

  intercept(contextoExecucao: ExecutionContext, proximo: CallHandler): Observable<unknown> {
    const http = contextoExecucao.switchToHttp();
    const req = http.getRequest<Request>();
    const contexto = obterContextoTenant();
    const chave = req.header('idempotency-key');

    if (
      chave === undefined ||
      req.method !== 'POST' ||
      !contexto ||
      (req.headers['content-type'] ?? '').startsWith('multipart/')
    ) {
      return proximo.handle();
    }

    if (!FORMATO_CHAVE.test(chave)) {
      throw new BadRequestException({
        codigo: CODIGOS_ERRO.VALIDACAO,
        mensagem: 'Idempotency-Key inválida: use de 8 a 128 caracteres (letras, números, _ : . -).',
      });
    }

    const impressao = createHash('sha256')
      .update(`${req.method} ${req.originalUrl}\n${JSON.stringify(req.body ?? {})}`)
      .digest('hex');
    const resposta = http.getResponse<Response>();

    return from(this.reivindicar(contexto, chave, impressao)).pipe(
      mergeMap((decisao) => {
        if (decisao.tipo === 'repetir') {
          // O status (201, 200…) o Nest aplica depois, a partir do mesmo
          // handler — é o mesmo da primeira execução.
          resposta.setHeader('Idempotent-Replayed', 'true');
          return of(decisao.resposta);
        }

        return proximo.handle().pipe(
          catchError((erro: unknown) =>
            // Falhou: libera a chave, senão a pessoa ficaria impedida de tentar de novo.
            from(this.liberar(contexto, chave, impressao)).pipe(
              mergeMap(() => throwError(() => erro)),
            ),
          ),
          mergeMap(async (corpo: unknown) => {
            await this.concluir(contexto, chave, impressao, corpo);
            return corpo;
          }),
        );
      }),
    );
  }

  /** Decide se este pedido executa ou repete a resposta de uma execução anterior. */
  private async reivindicar(
    contexto: TenantContext,
    chave: string,
    impressao: string,
  ): Promise<Decisao> {
    // Duas voltas bastam: a segunda só existe se a linha sumiu entre o conflito
    // e a leitura (liberada por quem falhou).
    for (let tentativa = 0; tentativa < 3; tentativa++) {
      const agora = new Date();

      try {
        await this.prisma.comTenant((tx) =>
          tx.chaveIdempotencia.create({
            data: {
              id: uuidv7(),
              tenantId: contexto.tenantId,
              usuarioId: contexto.usuarioId,
              chave,
              impressao,
              expiraEm: new Date(agora.getTime() + VALIDADE_MS),
            },
          }),
        );

        this.limparExpiradasDeVezEmQuando(agora);
        return { tipo: 'executar' };
      } catch (erro) {
        if (!(
          typeof erro === 'object' &&
          erro !== null &&
          'code' in erro &&
          erro.code === 'P2002'
        )) {
          throw erro;
        }
      }

      const existente = await this.prisma.comTenant((tx) =>
        tx.chaveIdempotencia.findFirst({ where: { usuarioId: contexto.usuarioId, chave } }),
      );

      if (!existente) continue;

      const expirada = existente.expiraEm <= agora;
      const abandonada =
        existente.status === 'em_andamento' &&
        agora.getTime() - existente.criadoEm.getTime() > ABANDONO_MS;

      if (expirada || abandonada) {
        // Assume a chave só se ela ainda está exatamente como lida: dois
        // pedidos assumindo ao mesmo tempo não podem executar os dois.
        const { count } = await this.prisma.comTenant((tx) =>
          tx.chaveIdempotencia.updateMany({
            where: { id: existente.id, status: existente.status, criadoEm: existente.criadoEm },
            data: {
              impressao,
              status: 'em_andamento',
              resposta: Prisma.DbNull,
              criadoEm: agora,
              expiraEm: new Date(agora.getTime() + VALIDADE_MS),
            },
          }),
        );

        if (count === 1) return { tipo: 'executar' };
        continue;
      }

      if (existente.impressao !== impressao) {
        throw new UnprocessableEntityException({
          codigo: CODIGOS_ERRO.VALIDACAO,
          mensagem:
            'Esta Idempotency-Key já foi usada em outro pedido. Gere uma chave nova para cada pedido diferente.',
        });
      }

      if (existente.status === 'concluida') {
        return { tipo: 'repetir', resposta: existente.resposta ?? undefined };
      }

      throw conflito(
        'Este pedido ainda está sendo processado. Aguarde um instante e confira o resultado.',
      );
    }

    throw conflito('Não foi possível confirmar este pedido agora. Tente novamente.');
  }

  /**
   * Guarda a resposta. Se falhar, só registra: a ação já aconteceu, e dizer à
   * pessoa que falhou a faria repetir. A chave fica "em andamento" e as
   * repetições recebem 409 até o prazo de abandono — o contrário (executar de
   * novo) é justamente o que a chave existe para impedir.
   */
  private async concluir(
    contexto: TenantContext,
    chave: string,
    impressao: string,
    corpo: unknown,
  ): Promise<void> {
    try {
      const texto = JSON.stringify(corpo ?? null);

      if (texto.length > LIMITE_RESPOSTA) {
        await this.liberar(contexto, chave, impressao);
        return;
      }

      await this.prisma.comTenant((tx) =>
        tx.chaveIdempotencia.updateMany({
          where: { usuarioId: contexto.usuarioId, chave, impressao, status: 'em_andamento' },
          data: {
            status: 'concluida',
            resposta:
              corpo === undefined || corpo === null
                ? Prisma.JsonNull
                : (JSON.parse(texto) as Prisma.InputJsonValue),
          },
        }),
      );
    } catch (erro) {
      this.logger.error(`Não foi possível guardar a resposta da chave ${chave}.`, erro);
    }
  }

  private async liberar(contexto: TenantContext, chave: string, impressao: string): Promise<void> {
    try {
      await this.prisma.comTenant((tx) =>
        tx.chaveIdempotencia.deleteMany({
          where: { usuarioId: contexto.usuarioId, chave, impressao, status: 'em_andamento' },
        }),
      );
    } catch (erro) {
      this.logger.error(`Não foi possível liberar a chave ${chave}.`, erro);
    }
  }

  /**
   * Remove as chaves vencidas, sem agendador: em ~2% das reivindicações, limpa
   * as da própria empresa (índice `tenant_id, expira_em`). Sem isto a tabela
   * só cresceria.
   */
  private limparExpiradasDeVezEmQuando(agora: Date): void {
    if (Math.random() >= 0.02) return;

    void this.prisma
      .comTenant((tx) => tx.chaveIdempotencia.deleteMany({ where: { expiraEm: { lt: agora } } }))
      .catch((erro: unknown) =>
        this.logger.warn(`Limpeza de chaves vencidas falhou: ${String(erro)}`),
      );
  }
}
