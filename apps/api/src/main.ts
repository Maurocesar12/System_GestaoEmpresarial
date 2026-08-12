import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import type { Env } from './config/env.schema';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService<Env, true>);
  const logger = new Logger('Bootstrap');

  // Cabeçalhos de segurança (arquitetura §9.2).
  app.use(helmet());

  // CORS restrito às origens configuradas — nunca '*', porque a API responde
  // a um frontend que envia credenciais.
  const origens = config
    .get('CORS_ORIGINS', { infer: true })
    .split(',')
    .map((origem) => origem.trim())
    .filter(Boolean);

  app.enableCors({
    origin: origens,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });

  // `/health` fica fora do prefixo: é o endpoint que o Render consulta.
  app.setGlobalPrefix(config.get('API_PREFIX', { infer: true }), {
    exclude: ['health'],
  });

  app.useGlobalFilters(new AllExceptionsFilter());

  // Permite ao Nest fechar conexões (banco, Redis) antes de o processo morrer.
  app.enableShutdownHooks();

  const porta = config.get('PORT', { infer: true });
  await app.listen(porta, '0.0.0.0');

  logger.log(`API ouvindo em http://localhost:${porta}`);
  logger.log(`Health check: http://localhost:${porta}/health`);
}

void bootstrap();
