import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { validateEnv, type Env } from './config/env.schema';
import { PrismaModule } from './infra/prisma/prisma.module';
import { HealthModule } from './modules/health/health.module';

/**
 * Raiz da aplicação.
 *
 * Os módulos de negócio (Auth, Tenant, Clientes, Financeiro...) entram aqui
 * conforme cada fatia vertical é entregue — ver `src/modules/`. O PrismaModule
 * entra junto com o schema e as políticas de RLS.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
      // Fora de desenvolvimento as variáveis vêm do ambiente do Render,
      // não de arquivo.
      ignoreEnvFile: process.env.NODE_ENV === 'production',
    }),

    // Rate limiting global (arquitetura §9.2). Login e signup recebem limite
    // próprio, mais apertado, quando o AuthModule entrar.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        throttlers: [
          {
            ttl: config.get('THROTTLE_TTL_MS', { infer: true }),
            limit: config.get('THROTTLE_LIMIT', { infer: true }),
          },
        ],
      }),
    }),

    PrismaModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
