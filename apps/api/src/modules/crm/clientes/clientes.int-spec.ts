import { Test, type TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../../../app.module';
import { PrismaService } from '../../../infra/prisma/prisma.service';

/**
 * Clientes, ponta a ponta.
 *
 * Além do CRUD, esta suíte cobre o que mais importa num SaaS multi-tenant: duas
 * empresas usando o sistema ao mesmo tempo, cada uma enxergando só a própria
 * carteira. É o mesmo tipo de verificação da suíte de isolamento, mas agora
 * atravessando a API inteira — guards, contexto de tenant e RLS juntos.
 */
describe('clientes (HTTP)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const marca = randomUUID().slice(0, 8);
  const tenantsCriados: string[] = [];

  /** Sessões de duas empresas diferentes, para os testes de isolamento. */
  let tokenA: string;
  let tokenB: string;

  async function criarEmpresa(sufixo: string): Promise<string> {
    const { body } = await request(app.getHttpServer())
      .post('/api/onboarding/cadastro')
      .send({
        nomeEmpresa: `Empresa ${sufixo} ${marca}`,
        nomeResponsavel: 'Responsável',
        email: `${sufixo}+${marca}@exemplo.com`,
        senha: 'senhaSegura123',
      })
      .expect(201);

    tenantsCriados.push(body.usuario.tenantId);
    return body.accessToken;
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

    tokenA = await criarEmpresa('empresa-a');
    tokenB = await criarEmpresa('empresa-b');
  });

  afterAll(async () => {
    for (const tenantId of tenantsCriados) {
      await prisma.comTenantExplicito(tenantId, (tx) =>
        tx.tenant.deleteMany({ where: { id: tenantId } }),
      );
    }
    await app.close();
  });

  const comToken = (token: string) => ({
    get: (rota: string) =>
      request(app.getHttpServer()).get(rota).set('Authorization', `Bearer ${token}`),
    post: (rota: string) =>
      request(app.getHttpServer()).post(rota).set('Authorization', `Bearer ${token}`),
    patch: (rota: string) =>
      request(app.getHttpServer()).patch(rota).set('Authorization', `Bearer ${token}`),
    delete: (rota: string) =>
      request(app.getHttpServer()).delete(rota).set('Authorization', `Bearer ${token}`),
  });

  describe('cadastro e edição', () => {
    it('cria um cliente com os dados normalizados', async () => {
      const resposta = await comToken(tokenA)
        .post('/api/clientes')
        .send({
          nome: '  Maria Souza  ',
          email: '  Maria@Exemplo.COM ',
          telefone: '(11) 91234-5678',
          documento: '123.456.789-09',
          origem: 'indicacao',
        })
        .expect(201);

      // Normalização acontece no schema compartilhado: o banco guarda só
      // dígitos no telefone e no documento, e o e-mail em minúsculas.
      expect(resposta.body.nome).toBe('Maria Souza');
      expect(resposta.body.email).toBe('maria@exemplo.com');
      expect(resposta.body.telefone).toBe('11912345678');
      expect(resposta.body.documento).toBe('12345678909');
    });

    it('grava campo vazio como nulo, e não como texto vazio', async () => {
      // Um input não preenchido envia "". Sem a conversão para null, "sem
      // e-mail" e "e-mail vazio" viram coisas diferentes nas consultas.
      const resposta = await comToken(tokenA)
        .post('/api/clientes')
        .send({ nome: 'Cliente Sem Contato', email: '', telefone: '', documento: '' })
        .expect(201);

      expect(resposta.body.email).toBeNull();
      expect(resposta.body.telefone).toBeNull();
    });

    it('recusa nome curto demais', async () => {
      const resposta = await comToken(tokenA).post('/api/clientes').send({ nome: 'X' }).expect(400);

      expect(resposta.body.detalhes).toHaveProperty('nome');
    });

    it('recusa telefone com quantidade de dígitos inválida', async () => {
      await comToken(tokenA)
        .post('/api/clientes')
        .send({ nome: 'Cliente Teste', telefone: '123' })
        .expect(400);
    });

    it('atualiza os dados de um cliente', async () => {
      const { body: criado } = await comToken(tokenA)
        .post('/api/clientes')
        .send({ nome: 'Nome Antigo' })
        .expect(201);

      const resposta = await comToken(tokenA)
        .patch(`/api/clientes/${criado.id}`)
        .send({ nome: 'Nome Novo', observacoes: 'Cliente preferencial' })
        .expect(200);

      expect(resposta.body.nome).toBe('Nome Novo');
      expect(resposta.body.observacoes).toBe('Cliente preferencial');
    });
  });

  describe('listagem', () => {
    it('encontra cliente por parte do nome', async () => {
      await comToken(tokenA).post('/api/clientes').send({ nome: 'Joaquim Pereira' }).expect(201);

      const resposta = await comToken(tokenA).get('/api/clientes?busca=joaquim').expect(200);

      expect(resposta.body.dados).toHaveLength(1);
      expect(resposta.body.dados[0].nome).toBe('Joaquim Pereira');
    });

    it('encontra cliente pelo telefone digitado com máscara', async () => {
      // Quem procura digita "(21) 98888", o banco guarda "21988887777".
      await comToken(tokenA)
        .post('/api/clientes')
        .send({ nome: 'Cliente Do Telefone', telefone: '21988887777' })
        .expect(201);

      const resposta = await comToken(tokenA).get('/api/clientes?busca=(21) 98888').expect(200);

      expect(resposta.body.dados).toHaveLength(1);
    });

    it('devolve os dados de paginação', async () => {
      const resposta = await comToken(tokenA).get('/api/clientes?porPagina=2').expect(200);

      expect(resposta.body.dados.length).toBeLessThanOrEqual(2);
      expect(resposta.body.meta.porPagina).toBe(2);
      expect(resposta.body.meta.total).toBeGreaterThan(0);
    });
  });

  describe('isolamento entre empresas', () => {
    it('cada empresa lista apenas os próprios clientes', async () => {
      await comToken(tokenB).post('/api/clientes').send({ nome: 'Cliente da B' }).expect(201);

      const daB = await comToken(tokenB).get('/api/clientes').expect(200);

      expect(daB.body.dados).toHaveLength(1);
      expect(daB.body.dados[0].nome).toBe('Cliente da B');
    });

    it('não encontra cliente de outra empresa nem com o id exato', async () => {
      const { body: cliente } = await comToken(tokenA)
        .post('/api/clientes')
        .send({ nome: 'Exclusivo da A' })
        .expect(201);

      // 404, e não 403: responder "sem permissão" confirmaria que o id existe.
      await comToken(tokenB).get(`/api/clientes/${cliente.id}`).expect(404);
    });

    it('não altera cliente de outra empresa', async () => {
      const { body: cliente } = await comToken(tokenA)
        .post('/api/clientes')
        .send({ nome: 'Intocável' })
        .expect(201);

      await comToken(tokenB)
        .patch(`/api/clientes/${cliente.id}`)
        .send({ nome: 'Alterado pela B' })
        .expect(404);

      const conferencia = await comToken(tokenA).get(`/api/clientes/${cliente.id}`).expect(200);

      expect(conferencia.body.nome).toBe('Intocável');
    });

    it('não apaga cliente de outra empresa', async () => {
      const { body: cliente } = await comToken(tokenA)
        .post('/api/clientes')
        .send({ nome: 'Persistente' })
        .expect(201);

      await comToken(tokenB).delete(`/api/clientes/${cliente.id}`).expect(404);

      await comToken(tokenA).get(`/api/clientes/${cliente.id}`).expect(200);
    });

    it('a busca de uma empresa não alcança dados da outra', async () => {
      // Filtro de busca é um lugar onde um `where` mal montado poderia
      // sobrescrever o escopo de tenant sem ninguém notar.
      const resposta = await comToken(tokenB).get('/api/clientes?busca=Exclusivo').expect(200);

      expect(resposta.body.dados).toHaveLength(0);
      expect(resposta.body.meta.total).toBe(0);
    });
  });

  describe('acesso', () => {
    it('recusa requisição sem token', async () => {
      await request(app.getHttpServer()).get('/api/clientes').expect(401);
    });

    it('recusa id malformado antes de consultar o banco', async () => {
      await comToken(tokenA).get('/api/clientes/nao-e-um-uuid').expect(400);
    });
  });
});
