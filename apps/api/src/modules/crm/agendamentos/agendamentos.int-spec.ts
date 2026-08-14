import { Test, type TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../../../app.module';
import { PrismaService } from '../../../infra/prisma/prisma.service';

/**
 * Agendamentos, ponta a ponta.
 *
 * Além do CRUD e da máquina de estados, cobre o que fecha o ciclo do CRM:
 * marcar um compromisso como executado registra o atendimento no histórico do
 * cliente sozinho.
 */
describe('agendamentos (HTTP)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const marca = randomUUID().slice(0, 8);
  const tenantsCriados: string[] = [];

  let tokenA: string;
  let tokenB: string;
  let clienteId: string;
  let servicoId: string;

  const req = (token: string) => ({
    get: (rota: string) =>
      request(app.getHttpServer()).get(rota).set('Authorization', `Bearer ${token}`),
    post: (rota: string) =>
      request(app.getHttpServer()).post(rota).set('Authorization', `Bearer ${token}`),
    patch: (rota: string) =>
      request(app.getHttpServer()).patch(rota).set('Authorization', `Bearer ${token}`),
    delete: (rota: string) =>
      request(app.getHttpServer()).delete(rota).set('Authorization', `Bearer ${token}`),
  });

  async function criarEmpresa(sufixo: string): Promise<string> {
    const { body } = await request(app.getHttpServer())
      .post('/api/onboarding/cadastro')
      .send({
        nomeEmpresa: `Agenda ${sufixo} ${marca}`,
        nomeResponsavel: 'Responsável',
        email: `agenda-${sufixo}+${marca}@exemplo.com`,
        senha: 'senhaSegura123',
      })
      .expect(201);

    tenantsCriados.push(body.usuario.tenantId);
    return body.accessToken;
  }

  /** Cria um agendamento pendente e devolve o id. */
  async function novoAgendamento(dataHora = '2026-09-10T14:30'): Promise<string> {
    const { body } = await req(tokenA)
      .post('/api/agendamentos')
      .send({ clienteId, servicoId, dataHora })
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
      .send({ nome: `Cliente Agenda ${marca}` })
      .expect(201);
    clienteId = cliente.id;

    const { body: servico } = await req(tokenA)
      .post('/api/servicos')
      .send({ nome: `Manutenção ${marca}`, custoBase: '80,00' })
      .expect(201);
    servicoId = servico.id;
  });

  afterAll(async () => {
    for (const tenantId of tenantsCriados) {
      await prisma.comTenantExplicito(tenantId, (tx) =>
        tx.tenant.deleteMany({ where: { id: tenantId } }),
      );
    }
    await app.close();
  });

  describe('agendamento', () => {
    it('cria com cliente, serviço e horário', async () => {
      const { body } = await req(tokenA)
        .post('/api/agendamentos')
        .send({ clienteId, servicoId, dataHora: '2026-09-15T09:00', observacoes: 'Levar escada' })
        .expect(201);

      expect(body.status).toBe('agendado');
      expect(body.clienteNome).toContain('Cliente Agenda');
      expect(body.servicoNome).toContain('Manutenção');
    });

    it('recusa data e hora em formato inválido', async () => {
      await req(tokenA)
        .post('/api/agendamentos')
        .send({ clienteId, dataHora: '15/09/2026' })
        .expect(400);
    });

    it('recusa cliente inexistente', async () => {
      await req(tokenA)
        .post('/api/agendamentos')
        .send({ clienteId: randomUUID(), dataHora: '2026-09-15T09:00' })
        .expect(404);
    });

    it('lista em ordem cronológica', async () => {
      // Uma agenda se lê pela ordem em que os compromissos acontecem, não pela
      // ordem em que foram cadastrados.
      const { body } = await req(tokenA).get('/api/agendamentos?porPagina=50').expect(200);

      const datas = body.dados.map((a: { dataHora: string }) => a.dataHora);
      const ordenadas = [...datas].sort();

      expect(datas).toEqual(ordenadas);
    });

    it('filtra por período, incluindo o dia final inteiro', async () => {
      // Um filtro "até 15/09" precisa incluir o compromisso das 09:00 daquele
      // dia — sem o fim de dia, ele ficaria de fora.
      const { body } = await req(tokenA)
        .get('/api/agendamentos?de=2026-09-15&ate=2026-09-15')
        .expect(200);

      expect(body.meta.total).toBeGreaterThan(0);
    });
  });

  describe('máquina de estados', () => {
    it('confirma um agendamento', async () => {
      const id = await novoAgendamento();

      const { body } = await req(tokenA)
        .post(`/api/agendamentos/${id}/status`)
        .send({ acao: 'confirmar' })
        .expect(201);

      expect(body.status).toBe('confirmado');
    });

    it('volta de confirmado para agendado', async () => {
      // O cliente confirmou e depois avisou que não poderá. Voltar é mais
      // honesto que cancelar e recriar.
      const id = await novoAgendamento();

      await req(tokenA).post(`/api/agendamentos/${id}/status`).send({ acao: 'confirmar' });

      const { body } = await req(tokenA)
        .post(`/api/agendamentos/${id}/status`)
        .send({ acao: 'reagendar' })
        .expect(201);

      expect(body.status).toBe('agendado');
    });

    it('cancela e remarca depois', async () => {
      const id = await novoAgendamento();

      await req(tokenA)
        .post(`/api/agendamentos/${id}/status`)
        .send({ acao: 'cancelar' })
        .expect(201);

      const { body } = await req(tokenA)
        .post(`/api/agendamentos/${id}/status`)
        .send({ acao: 'reagendar' })
        .expect(201);

      expect(body.status).toBe('agendado');
    });

    it('não desfaz um agendamento executado', async () => {
      const id = await novoAgendamento();

      await req(tokenA).post(`/api/agendamentos/${id}/status`).send({ acao: 'executar' });

      const resposta = await req(tokenA)
        .post(`/api/agendamentos/${id}/status`)
        .send({ acao: 'reagendar' })
        .expect(400);

      expect(resposta.body.mensagem).toMatch(/não aceita mais/i);
    });

    it('não altera agendamento já executado', async () => {
      const id = await novoAgendamento();

      await req(tokenA).post(`/api/agendamentos/${id}/status`).send({ acao: 'executar' });

      await req(tokenA)
        .patch(`/api/agendamentos/${id}`)
        .send({ clienteId, dataHora: '2026-10-01T10:00' })
        .expect(400);
    });

    it('não exclui agendamento executado', async () => {
      const id = await novoAgendamento();

      await req(tokenA).post(`/api/agendamentos/${id}/status`).send({ acao: 'executar' });

      await req(tokenA).delete(`/api/agendamentos/${id}`).expect(400);
    });
  });

  describe('fecho do ciclo com o histórico', () => {
    it('executar um agendamento registra o atendimento no histórico', async () => {
      const antes = await req(tokenA).get(`/api/clientes/${clienteId}/atendimentos`).expect(200);

      const id = await novoAgendamento('2026-09-20T11:00');
      await req(tokenA)
        .post(`/api/agendamentos/${id}/status`)
        .send({ acao: 'executar' })
        .expect(201);

      const depois = await req(tokenA).get(`/api/clientes/${clienteId}/atendimentos`).expect(200);

      expect(depois.body.length).toBe(antes.body.length + 1);
      // A descrição sai do serviço do catálogo — quem executou não precisa
      // digitar de novo o que o sistema já sabia.
      expect(depois.body[0].descricao).toContain('Manutenção');
    });

    it('o atendimento fica com a data do compromisso, não a de hoje', async () => {
      // Marcar na segunda um serviço feito na sexta não pode gravar segunda.
      const id = await novoAgendamento('2026-09-25T08:00');
      await req(tokenA).post(`/api/agendamentos/${id}/status`).send({ acao: 'executar' });

      const { body } = await req(tokenA).get(`/api/clientes/${clienteId}/atendimentos`);
      const registrado = body.find((a: { data: string }) => a.data === '2026-09-25');

      expect(registrado).toBeDefined();
    });
  });

  describe('isolamento entre empresas', () => {
    it('não lista agendamentos de outra empresa', async () => {
      const { body } = await req(tokenB).get('/api/agendamentos').expect(200);

      expect(body.meta.total).toBe(0);
    });

    it('não encontra agendamento de outra empresa pelo id', async () => {
      const id = await novoAgendamento();

      await req(tokenB).get(`/api/agendamentos/${id}`).expect(404);
    });

    it('não muda o status de agendamento de outra empresa', async () => {
      const id = await novoAgendamento();

      await req(tokenB)
        .post(`/api/agendamentos/${id}/status`)
        .send({ acao: 'cancelar' })
        .expect(404);
    });
  });
});
