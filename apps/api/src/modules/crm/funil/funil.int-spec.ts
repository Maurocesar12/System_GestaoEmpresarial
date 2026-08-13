import { Test, type TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../../../app.module';
import { PrismaService } from '../../../infra/prisma/prisma.service';

/**
 * Funil de vendas, ponta a ponta.
 *
 * Cobre a movimentação, a estrutura das etapas e — como todo módulo que toca
 * dados de empresa — o isolamento entre tenants.
 */
describe('funil (HTTP)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const marca = randomUUID().slice(0, 8);
  const tenantsCriados: string[] = [];

  let tokenA: string;
  let tokenB: string;

  async function criarEmpresa(sufixo: string): Promise<string> {
    const { body } = await request(app.getHttpServer())
      .post('/api/onboarding/cadastro')
      .send({
        nomeEmpresa: `Funil ${sufixo} ${marca}`,
        nomeResponsavel: 'Responsável',
        email: `funil-${sufixo}+${marca}@exemplo.com`,
        senha: 'senhaSegura123',
      })
      .expect(201);

    tenantsCriados.push(body.usuario.tenantId);
    return body.accessToken;
  }

  const comToken = (token: string) => ({
    get: (rota: string) =>
      request(app.getHttpServer()).get(rota).set('Authorization', `Bearer ${token}`),
    post: (rota: string) =>
      request(app.getHttpServer()).post(rota).set('Authorization', `Bearer ${token}`),
    patch: (rota: string) =>
      request(app.getHttpServer()).patch(rota).set('Authorization', `Bearer ${token}`),
    put: (rota: string) =>
      request(app.getHttpServer()).put(rota).set('Authorization', `Bearer ${token}`),
    delete: (rota: string) =>
      request(app.getHttpServer()).delete(rota).set('Authorization', `Bearer ${token}`),
  });

  async function criarCliente(token: string, nome: string): Promise<string> {
    const { body } = await comToken(token).post('/api/clientes').send({ nome }).expect(201);
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
  });

  afterAll(async () => {
    for (const tenantId of tenantsCriados) {
      await prisma.comTenantExplicito(tenantId, (tx) =>
        tx.tenant.deleteMany({ where: { id: tenantId } }),
      );
    }
    await app.close();
  });

  describe('etapas iniciais', () => {
    it('a empresa nasce com as sete etapas do funil', async () => {
      // Vêm do cadastro self-service, não de uma ação manual: um funil vazio
      // exigiria configuração antes do primeiro uso.
      const resposta = await comToken(tokenA).get('/api/funil/etapas').expect(200);

      expect(resposta.body).toHaveLength(7);
      expect(resposta.body[0].nome).toBe('Novo contato');
      expect(resposta.body[6].nome).toBe('Pós-venda');
    });

    it('monta o quadro com uma coluna por etapa', async () => {
      const resposta = await comToken(tokenA).get('/api/funil').expect(200);

      expect(resposta.body.colunas).toHaveLength(7);
      expect(resposta.body.colunas[0].clientes).toEqual([]);
    });
  });

  describe('movimentação', () => {
    it('coloca um cliente no funil e depois o move de etapa', async () => {
      const clienteId = await criarCliente(tokenA, `Cliente Funil ${marca}`);
      const { body: etapas } = await comToken(tokenA).get('/api/funil/etapas');

      await comToken(tokenA)
        .post('/api/funil/mover')
        .send({ clienteId, etapaId: etapas[0].id })
        .expect(204);

      // Mesma rota para entrar e para mover: da perspectiva de quem arrasta o
      // cartão, é a mesma ação.
      await comToken(tokenA)
        .post('/api/funil/mover')
        .send({ clienteId, etapaId: etapas[3].id })
        .expect(204);

      const { body: quadro } = await comToken(tokenA).get('/api/funil').expect(200);

      expect(quadro.colunas[0].clientes).toHaveLength(0);
      expect(quadro.colunas[3].clientes[0].id).toBe(clienteId);
    });

    it('permite voltar o cliente para uma etapa anterior', async () => {
      // Movimentação livre é uma decisão de produto: negociação real não é
      // linear, e um funil que recusa o retrocesso deixa de ser atualizado.
      const clienteId = await criarCliente(tokenA, `Cliente Volta ${marca}`);
      const { body: etapas } = await comToken(tokenA).get('/api/funil/etapas');

      await comToken(tokenA)
        .post('/api/funil/mover')
        .send({ clienteId, etapaId: etapas[4].id })
        .expect(204);

      await comToken(tokenA)
        .post('/api/funil/mover')
        .send({ clienteId, etapaId: etapas[1].id })
        .expect(204);

      const { body: quadro } = await comToken(tokenA).get('/api/funil');
      expect(quadro.colunas[1].clientes.some((c: { id: string }) => c.id === clienteId)).toBe(true);
    });

    it('tira o cliente do funil sem apagar o cadastro', async () => {
      const clienteId = await criarCliente(tokenA, `Cliente Saida ${marca}`);
      const { body: etapas } = await comToken(tokenA).get('/api/funil/etapas');

      await comToken(tokenA)
        .post('/api/funil/mover')
        .send({ clienteId, etapaId: etapas[0].id })
        .expect(204);

      await comToken(tokenA).delete(`/api/funil/clientes/${clienteId}`).expect(204);

      // Sai do quadro, continua na carteira.
      await comToken(tokenA).get(`/api/clientes/${clienteId}`).expect(200);
    });

    it('recusa mover para uma etapa que não existe', async () => {
      const clienteId = await criarCliente(tokenA, `Cliente Erro ${marca}`);

      await comToken(tokenA)
        .post('/api/funil/mover')
        .send({ clienteId, etapaId: randomUUID() })
        .expect(404);
    });
  });

  describe('estrutura das etapas', () => {
    it('cria uma etapa no fim do funil', async () => {
      const resposta = await comToken(tokenA)
        .post('/api/funil/etapas')
        .send({ nome: `Etapa Extra ${marca}` })
        .expect(201);

      expect(resposta.body.ordem).toBe(8);
    });

    it('renomeia uma etapa', async () => {
      const { body: etapas } = await comToken(tokenA).get('/api/funil/etapas');

      const resposta = await comToken(tokenA)
        .patch(`/api/funil/etapas/${etapas[7].id}`)
        .send({ nome: 'Nome Renomeado' })
        .expect(200);

      expect(resposta.body.nome).toBe('Nome Renomeado');
    });

    it('recusa excluir etapa que ainda tem cliente', async () => {
      // Excluir em cascata tiraria pessoas do funil sem aviso.
      const { body: etapas } = await comToken(tokenA).get('/api/funil/etapas');
      const comCliente = etapas[1];

      const resposta = await comToken(tokenA)
        .delete(`/api/funil/etapas/${comCliente.id}`)
        .expect(400);

      expect(resposta.body.mensagem).toMatch(/cliente/i);
    });

    it('exclui etapa vazia', async () => {
      const { body: etapas } = await comToken(tokenA).get('/api/funil/etapas');
      const vazia = etapas[etapas.length - 1];

      await comToken(tokenA).delete(`/api/funil/etapas/${vazia.id}`).expect(204);
    });

    it('reordena as etapas invertendo a ordem', async () => {
      // A coluna `ordem` é única por empresa, então a troca precisa passar por
      // valores temporários — sem isso, a restrição do banco bloquearia no meio.
      const { body: antes } = await comToken(tokenA).get('/api/funil/etapas');
      const invertida = [...antes].reverse().map((e: { id: string }) => e.id);

      const resposta = await comToken(tokenA)
        .put('/api/funil/etapas/ordem')
        .send({ etapaIds: invertida })
        .expect(200);

      expect(resposta.body[0].nome).toBe(antes[antes.length - 1].nome);
      expect(resposta.body.map((e: { ordem: number }) => e.ordem)).toEqual(
        antes.map((_: unknown, i: number) => i + 1),
      );
    });

    it('recusa reordenação incompleta', async () => {
      const { body: etapas } = await comToken(tokenA).get('/api/funil/etapas');

      await comToken(tokenA)
        .put('/api/funil/etapas/ordem')
        .send({ etapaIds: [etapas[0].id] })
        .expect(400);
    });
  });

  describe('isolamento entre empresas', () => {
    it('cada empresa tem o próprio conjunto de etapas', async () => {
      const { body: daB } = await comToken(tokenB).get('/api/funil/etapas').expect(200);

      // A empresa A criou, renomeou e excluiu etapas; a B segue com as sete
      // originais, intactas.
      expect(daB).toHaveLength(7);
      expect(daB.map((e: { nome: string }) => e.nome)).not.toContain('Nome Renomeado');
    });

    it('não move cliente de outra empresa', async () => {
      const clienteDaA = await criarCliente(tokenA, `Alvo Funil ${marca}`);
      const { body: etapasB } = await comToken(tokenB).get('/api/funil/etapas');

      await comToken(tokenB)
        .post('/api/funil/mover')
        .send({ clienteId: clienteDaA, etapaId: etapasB[0].id })
        .expect(404);
    });

    it('o quadro de uma empresa não mostra clientes da outra', async () => {
      const { body: quadro } = await comToken(tokenB).get('/api/funil').expect(200);

      const total = quadro.colunas.reduce(
        (soma: number, coluna: { clientes: unknown[] }) => soma + coluna.clientes.length,
        0,
      );

      expect(total).toBe(0);
    });
  });
});
