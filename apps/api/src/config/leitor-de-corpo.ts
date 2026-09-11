import { MAX_BYTES_CORPO_LANCAMENTO } from '@gestao/shared-types';
import type { NestExpressApplication } from '@nestjs/platform-express';

/**
 * Registra os leitores de corpo da requisição com o teto dos anexos.
 *
 * O padrão do Nest é 100 kB — não cabe nem um PDF simples. Como nota fiscal e
 * boleto viajam em base64 dentro do JSON do lançamento, o envio morria com 413
 * depois de a pessoa preencher o formulário inteiro, sem dizer o motivo.
 *
 * Mora fora do `main.ts` porque aquele arquivo chama `bootstrap()` ao ser
 * importado: para o teste conseguir montar um app com esta mesma configuração,
 * ela precisa estar em um módulo que dê para importar sozinho.
 */
export function aplicarLeitorDeCorpo(app: NestExpressApplication): void {
  app.useBodyParser('json', { limit: MAX_BYTES_CORPO_LANCAMENTO });
  app.useBodyParser('urlencoded', { limit: MAX_BYTES_CORPO_LANCAMENTO, extended: true });
}
