import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle } from '@nestjs/throttler';
import type { HealthResponse } from '@gestao/shared-types';
import { Publico } from '../../common/decorators/publico.decorator';
import type { Env } from '../../config/env.schema';

/**
 * Health check.
 *
 * Fica fora do prefixo global (`/health`, não `/api/health`) porque é o
 * endpoint que o Render consulta para decidir se a instância está viva. Também
 * é o smoke test que prova que frontend e API se enxergam.
 *
 * Sem rate limit: o health check do Render bate de minuto em minuto e não pode
 * ser barrado pelo throttler.
 *
 * E `@Publico()` porque o guard de autenticação vale para todas as rotas por
 * padrão. Sem isso, o Render receberia 401, concluiria que a instância está
 * quebrada e a reiniciaria em loop — com a aplicação funcionando perfeitamente.
 */
@Controller('health')
@Publico()
@SkipThrottle()
export class HealthController {
  constructor(private readonly config: ConfigService<Env, true>) {}

  @Get()
  verificar(): HealthResponse {
    return {
      status: 'ok',
      versao: process.env.npm_package_version ?? '0.0.0',
      ambiente: this.config.get('NODE_ENV', { infer: true }),
      timestamp: new Date().toISOString(),
    };
  }
}
