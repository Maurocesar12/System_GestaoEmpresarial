import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import type { Env } from './config/env.schema';
import { aplicarLeitorDeCorpo } from './config/leitor-de-corpo';

async function bootstrap(): Promise<void> {
  // `bodyParser: false` desliga o parser padrão do Nest, que vem com limite de
  // 100 kB. Ele é registrado aqui embaixo com o teto do lançamento: nota fiscal
  // e boleto viajam em base64 dentro do JSON, e 100 kB não cabe nem um PDF
  // simples — o envio morria com 413 depois de o formulário estar preenchido.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    bodyParser: false,
  });
  const config = app.get(ConfigService<Env, true>);
  const logger = new Logger('Bootstrap');

  aplicarLeitorDeCorpo(app);

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
