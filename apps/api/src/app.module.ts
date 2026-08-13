import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PapeisGuard } from './common/guards/papeis.guard';
import { validateEnv, type Env } from './config/env.schema';
import { PrismaModule } from './infra/prisma/prisma.module';
import { TenantMiddleware } from './infra/tenant/tenant.middleware';
import { AuthModule } from './modules/auth/auth.module';
import { ClientesModule } from './modules/crm/clientes/clientes.module';
import { FunilModule } from './modules/crm/funil/funil.module';
import { OrcamentosModule } from './modules/crm/orcamentos/orcamentos.module';
import { ServicosModule } from './modules/crm/servicos/servicos.module';
import { HealthModule } from './modules/health/health.module';
import { OnboardingModule } from './modules/onboarding/onboarding.module';

/**
 * Raiz da aplicação.
 *
 * Os módulos de negócio (Clientes, Funil, Financeiro...) entram aqui conforme
 * cada fatia vertical é entregue — ver `src/modules/`.
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

    // Rate limiting global (arquitetura §9.2). Login, refresh e cadastro têm
    // limites próprios, bem mais apertados, declarados nos controllers.
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
    AuthModule,
    OnboardingModule,
    ClientesModule,
    FunilModule,
    ServicosModule,
    OrcamentosModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      // Toda rota exige autenticação. As exceções se declaram com `@Publico()`.
      // O padrão fechado é intencional: esquecer o decorator resulta em rota
      // protegida, e não em rota aberta por acidente.
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      // Roda depois do JwtAuthGuard — a ordem aqui é a ordem de execução.
      provide: APP_GUARD,
      useClass: PapeisGuard,
    },
  ],
})
export class AppModule implements NestModule {
  /**
   * O middleware de tenant precisa rodar antes de tudo, em todas as rotas.
   *
   * É ele que abre o escopo do `AsyncLocalStorage` em volta da requisição — e
   * só um middleware consegue fazer isso, porque chama `next()` de dentro do
   * escopo. Guards e interceptors decidem se a requisição segue, mas não
   * envolvem o que vem depois.
   */
  configure(consumer: MiddlewareConsumer): void {
    // `{*path}` e não `*`: o Express 5 mudou a sintaxe de curinga em rotas, e
    // o `*` sozinho gera aviso de rota não suportada na subida.
    consumer.apply(TenantMiddleware).forRoutes('{*path}');
  }
}
