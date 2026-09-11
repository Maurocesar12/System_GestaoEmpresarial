import { Body, Controller, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { MAX_BYTES_ANEXO_LANCAMENTO, MAX_BYTES_CORPO_LANCAMENTO } from '@gestao/shared-types';
import request from 'supertest';
import { aplicarLeitorDeCorpo } from './leitor-de-corpo';

@Controller('eco')
class EcoController {
  @Post()
  responder(@Body() corpo: { conteudo?: string }): { bytes: number } {
    return { bytes: corpo.conteudo?.length ?? 0 };
  }
}

/**
 * O limite de corpo só se manifesta com arquivo grande, em produção, depois de
 * o formulário estar preenchido. Este teste antecipa isso com um corpo do
 * tamanho de um anexo real.
 */
describe('leitor de corpo da API', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({ controllers: [EcoController] }).compile();

    app = modulo.createNestApplication<NestExpressApplication>({ bodyParser: false });
    aplicarLeitorDeCorpo(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('aceita um anexo de 2 MB em base64, que o padrão de 100 kB recusaria', async () => {
    // ~2,7 MB de texto: é o que um anexo no limite vira depois do base64.
    const conteudo = 'a'.repeat(Math.ceil((MAX_BYTES_ANEXO_LANCAMENTO * 4) / 3));

    const resposta = await request(app.getHttpServer()).post('/eco').send({ conteudo });

    expect(resposta.status).toBe(201);
    expect(resposta.body).toEqual({ bytes: conteudo.length });
  });

  it('ainda recusa corpo acima do teto', async () => {
    const conteudo = 'a'.repeat(MAX_BYTES_CORPO_LANCAMENTO + 1024);

    const resposta = await request(app.getHttpServer()).post('/eco').send({ conteudo });

    expect(resposta.status).toBe(413);
  });
});
