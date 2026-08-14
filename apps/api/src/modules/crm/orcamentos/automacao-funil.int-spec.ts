import { Test, type TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../../../app.module';
import { PrismaService } from '../../../infra/prisma/prisma.service';

/**
 * Automação entre orçamentos e funil.
 *
 * É o comportamento que faz os módulos deixarem de ser ilhas: emitir uma
 * proposta e fechá-la movem o cliente no quadro sozinhos, sem ninguém precisar
 * lembrar de arrastar o cartão.
 *
 * O que estes testes protegem, além do caminho feliz: que a automação siga o
 * **marco** e não o nome da etapa (renomear não pode quebrá-la), e que ela
 * nunca impeça a operação principal de acontecer.
 */
describe('automação entre orçamentos e funil (HTTP)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const marca = randomUUID().slice(0, 8);
  const tenantsCriados: string[] = [];
  let token: string;

  const req = () => ({
    get: (rota: string) =>
      request(app.getHttpServer()).get(rota).set('Authorization', `Bearer ${token}`),
    post: (rota: string) =>
      request(app.getHttpServer()).post(rota).set('Authorization', `Bearer ${token}`),
    patch: (rota: string) =>
      request(app.getHttpServer()).patch(rota).set('Authorization', `Bearer ${token}`),
    delete: (rota: string) =>
      request(app.getHttpServer()).delete(rota).set('Authorization', `Bearer ${token}`),
  });

  async function criarCliente(nome: string): Promise<string> {
    const { body } = await req().post('/api/clientes').send({ nome }).expect(201);
    return body.id;
  }

  /** Em que etapa o cliente está agora, pelo nome. */
  async function etapaDoCliente(clienteId: string): Promise<string | null> {
    const { body: quadro } = await req().get('/api/funil').expect(200);

    const coluna = quadro.colunas.find((c: { clientes: { id: string }[] }) =>
      c.clientes.some((cliente) => cliente.id === clienteId),
    );

    return coluna?.etapa.nome ?? null;
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

    const { body } = await request(app.getHttpServer())
      .post('/api/onboarding/cadastro')
      .send({
        nomeEmpresa: `Automação ${marca}`,
        nomeResponsavel: 'Responsável',
        email: `auto+${marca}@exemplo.com`,
        senha: 'senhaSegura123',
      })
      .expect(201);

    tenantsCriados.push(body.usuario.tenantId);
    token = body.accessToken;
  });

  afterAll(async () => {
    for (const tenantId of tenantsCriados) {
      await prisma.comTenantExplicito(tenantId, (tx) =>
        tx.tenant.deleteMany({ where: { id: tenantId } }),
      );
    }
    await app.close();
  });

  it('cliente novo já entra na primeira etapa do funil', async () => {
    // Todo cadastro é uma oportunidade em potencial. Um funil que só recebe
    // quem alguém lembrou de arrastar mostra menos do que a realidade.
    const clienteId = await criarCliente(`Cliente Entrada ${marca}`);

    expect(await etapaDoCliente(clienteId)).toBe('Novo contato');
  });

  it('emitir orçamento move o cliente para a etapa de orçamento enviado', async () => {
    const clienteId = await criarCliente(`Cliente Auto ${marca}`);

    await req().post('/api/orcamentos').send({ clienteId, valor: '800,00' }).expect(201);

    expect(await etapaDoCliente(clienteId)).toBe('Orçamento enviado');
  });

  it('aprovar orçamento move o cliente para a etapa de fechamento', async () => {
    const clienteId = await criarCliente(`Cliente Fecha ${marca}`);

    const { body: orcamento } = await req()
      .post('/api/orcamentos')
      .send({ clienteId, valor: '1.200,00' })
      .expect(201);

    await req()
      .post(`/api/orcamentos/${orcamento.id}/status`)
      .send({ acao: 'aprovar' })
      .expect(201);

    expect(await etapaDoCliente(clienteId)).toBe('Fechado');
  });

  it('recusar orçamento não move o cliente', async () => {
    // Recusa não é fim de negociação. Tirar a pessoa do lugar esconderia
    // justamente o caso que precisa de atenção.
    const clienteId = await criarCliente(`Cliente Recusa ${marca}`);

    const { body: orcamento } = await req()
      .post('/api/orcamentos')
      .send({ clienteId, valor: '500,00' })
      .expect(201);

    await req()
      .post(`/api/orcamentos/${orcamento.id}/status`)
      .send({ acao: 'recusar' })
      .expect(201);

    expect(await etapaDoCliente(clienteId)).toBe('Orçamento enviado');
  });

  it('a automação segue o marco, não o nome da etapa', async () => {
    // O teste que dá sentido ao campo `marco`: a empresa renomeia "Fechado"
    // para o vocabulário dela e a automação continua funcionando.
    const { body: etapas } = await req().get('/api/funil/etapas').expect(200);
    const fechado = etapas.find((e: { nome: string }) => e.nome === 'Fechado');

    await req()
      .patch(`/api/funil/etapas/${fechado.id}`)
      .send({ nome: 'Serviço vendido' })
      .expect(200);

    const clienteId = await criarCliente(`Cliente Renomeado ${marca}`);
    const { body: orcamento } = await req()
      .post('/api/orcamentos')
      .send({ clienteId, valor: '900,00' })
      .expect(201);

    await req()
      .post(`/api/orcamentos/${orcamento.id}/status`)
      .send({ acao: 'aprovar' })
      .expect(201);

    expect(await etapaDoCliente(clienteId)).toBe('Serviço vendido');
  });

  it('o orçamento é emitido mesmo sem etapa com o marco', async () => {
    // A automação é conveniência, não requisito: uma empresa que apagou a
    // etapa não pode ficar impedida de trabalhar.
    const { body: etapas } = await req().get('/api/funil/etapas').expect(200);
    const enviado = etapas.find((e: { nome: string }) => e.nome === 'Orçamento enviado');

    // Tira o marco da etapa, simulando quem reorganizou o funil do próprio jeito.
    await prisma.comTenantExplicito(tenantsCriados[0]!, (tx) =>
      tx.etapaFunil.update({ where: { id: enviado.id }, data: { marco: null } }),
    );

    const clienteId = await criarCliente(`Cliente Sem Marco ${marca}`);

    await req().post('/api/orcamentos').send({ clienteId, valor: '300,00' }).expect(201);

    // Orçamento criado normalmente. O cliente ficou onde estava — na primeira
    // etapa, onde o cadastro o colocou —, sem avançar.
    expect(await etapaDoCliente(clienteId)).toBe('Novo contato');
  });
});
