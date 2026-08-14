import { Test, type TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../../../app.module';
import { PrismaService } from '../../../infra/prisma/prisma.service';

describe('lembretes (HTTP)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const marca = randomUUID().slice(0, 8);
  const tenantsCriados: string[] = [];

  let tokenA: string;
  let tokenB: string;
  let clienteId: string;

  const req = (token: string) => ({
    get: (rota: string) =>
      request(app.getHttpServer()).get(rota).set('Authorization', `Bearer ${token}`),
    post: (rota: string) =>
      request(app.getHttpServer()).post(rota).set('Authorization', `Bearer ${token}`),
  });

  async function criarEmpresa(sufixo: string): Promise<string> {
    const { body } = await request(app.getHttpServer())
      .post('/api/onboarding/cadastro')
      .send({
        nomeEmpresa: `Lembretes ${sufixo} ${marca}`,
        nomeResponsavel: 'Responsável',
        email: `lembretes-${sufixo}+${marca}@exemplo.com`,
        senha: 'senhaSegura123',
      })
      .expect(201);

    tenantsCriados.push(body.usuario.tenantId);
    return body.accessToken;
  }

  async function novoLembrete(dataEnvio = '2026-09-18T10:00'): Promise<string> {
    const { body } = await req(tokenA)
      .post('/api/lembretes')
      .send({ clienteId, canal: 'email', dataEnvio })
      .expect(201);

    return body.id;
  }

  beforeAll(async () => {
    const modulo: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = modulo.createNestApplication();
    app.setGlobalPrefix('api', { exclude: ['health'] });
    await app.init();

    prisma = modulo.get(PrismaService);

    const slug = process.env.ONBOARDING_PLANO_PADRAO ?? 'essencial';
    await prisma.plano.upsert({
      where: { slug },
      create: { nome: 'Plano de teste', slug, preco: '0.00' },
      update: {},
    });

    tokenA = await criarEmpresa('a');
    tokenB = await criarEmpresa('b');

    const { body: cliente } = await req(tokenA)
      .post('/api/clientes')
      .send({ nome: `Cliente Lembrete ${marca}`, email: `cliente-${marca}@exemplo.com` })
      .expect(201);
    clienteId = cliente.id;
  });

  afterAll(async () => {
    for (const tenantId of tenantsCriados) {
      await prisma.comTenantExplicito(tenantId, (tx) =>
        tx.tenant.deleteMany({ where: { id: tenantId } }),
      );
    }
    await app.close();
  });

  it('cria lembrete pendente vinculado ao cliente', async () => {
    const { body } = await req(tokenA)
      .post('/api/lembretes')
      .send({ clienteId, canal: 'whatsapp', dataEnvio: '2026-09-20T15:30' })
      .expect(201);

    expect(body.status).toBe('pendente');
    expect(body.canal).toBe('whatsapp');
    expect(body.clienteNome).toContain('Cliente Lembrete');
    expect(body.clienteEmail).toBe(`cliente-${marca}@exemplo.com`);
  });

  it('recusa canal inválido e data sem hora', async () => {
    await req(tokenA)
      .post('/api/lembretes')
      .send({ clienteId, canal: 'sms', dataEnvio: '2026-09-20' })
      .expect(400);
  });

  it('recusa cliente inexistente', async () => {
    await req(tokenA)
      .post('/api/lembretes')
      .send({ clienteId: randomUUID(), canal: 'email', dataEnvio: '2026-09-20T15:30' })
      .expect(404);
  });

  it('lista e filtra por status, canal e período', async () => {
    await novoLembrete('2026-09-21T09:00');

    const { body } = await req(tokenA)
      .get('/api/lembretes?status=pendente&canal=email&de=2026-09-21&ate=2026-09-21')
      .expect(200);

    expect(body.meta.total).toBeGreaterThan(0);
    expect(
      body.dados.every(
        (l: { status: string; canal: string }) => l.status === 'pendente' && l.canal === 'email',
      ),
    ).toBe(true);
  });

  it('cancela lembrete pendente', async () => {
    const id = await novoLembrete();

    const { body } = await req(tokenA).post(`/api/lembretes/${id}/cancelar`).expect(201);

    expect(body.status).toBe('cancelado');
  });

  it('não cancela lembrete já enviado', async () => {
    const id = await novoLembrete('2026-09-22T08:00');

    await prisma.comTenantExplicito(tenantsCriados[0]!, (tx) =>
      tx.lembreteFollowUp.update({
        where: { id },
        data: { status: 'enviado', enviadoEm: new Date('2026-09-22T08:00:00Z') },
      }),
    );

    const resposta = await req(tokenA).post(`/api/lembretes/${id}/cancelar`).expect(400);

    expect(resposta.body.mensagem).toMatch(/não pode ser cancelado/i);
  });

  it('não lista lembretes de outra empresa', async () => {
    await novoLembrete('2026-09-23T10:00');

    const { body } = await req(tokenB).get('/api/lembretes').expect(200);

    expect(body.meta.total).toBe(0);
  });

  it('não encontra lembrete de outra empresa pelo id', async () => {
    const id = await novoLembrete('2026-09-24T10:00');

    await req(tokenB).get(`/api/lembretes/${id}`).expect(404);
  });
});
