import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AuditoriaController } from './auditoria.controller';
import { AuditoriaService } from './auditoria.service';

/**
 * Garante que as rotas de exclusão existem no endereço que o frontend chama.
 *
 * Um erro de caminho no controller não aparece em teste de serviço nem no
 * typecheck: a API sobe limpa e responde "Cannot DELETE /api/auditoria" só na
 * hora do clique. Este teste sobe o controller de verdade, com o mesmo prefixo
 * global do `main.ts`, e bate nas rotas como o navegador bateria.
 *
 * Os guards globais (JWT, permissão, papel) ficam de fora: aqui o assunto é o
 * roteamento. Quem cuida do papel é o `PapeisGuard`, com testes próprios.
 */
describe('AuditoriaController (rotas)', () => {
  const auditoria = {
    listar: jest.fn(),
    remover: jest.fn(),
    removerVarios: jest.fn(),
  };

  let app: INestApplication;

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      controllers: [AuditoriaController],
      providers: [{ provide: AuditoriaService, useValue: auditoria }],
    }).compile();

    app = modulo.createNestApplication();
    app.setGlobalPrefix('api', { exclude: ['health'] });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => jest.resetAllMocks());

  const id = '0198f1a0-0000-7000-8000-000000000001';

  it('exclui em lote em DELETE /api/auditoria', async () => {
    auditoria.removerVarios.mockResolvedValue(2);

    const resposta = await request(app.getHttpServer())
      .delete('/api/auditoria')
      .send({ ids: [id, '0198f1a0-0000-7000-8000-000000000002'] });

    expect(resposta.status).toBe(200);
    expect(resposta.body).toEqual({ removidos: 2 });
  });

  it('recusa lote inválido antes de chegar ao serviço', async () => {
    const resposta = await request(app.getHttpServer()).delete('/api/auditoria').send({ ids: [] });

    expect(resposta.status).toBe(400);
    expect(auditoria.removerVarios).not.toHaveBeenCalled();
  });

  it('exclui um registro em DELETE /api/auditoria/:id', async () => {
    auditoria.remover.mockResolvedValue(undefined);

    const resposta = await request(app.getHttpServer()).delete(`/api/auditoria/${id}`);

    expect(resposta.status).toBe(204);
    expect(auditoria.remover).toHaveBeenCalledWith(id);
  });

  it('recusa id que não é uuid', async () => {
    const resposta = await request(app.getHttpServer()).delete('/api/auditoria/nao-e-uuid');

    expect(resposta.status).toBe(400);
    expect(auditoria.remover).not.toHaveBeenCalled();
  });
});
