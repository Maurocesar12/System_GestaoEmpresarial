import { Test, type TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import {
  CODIGOS_ERRO,
  DIAS_PARA_EXCLUIR_CONTA_CANCELADA,
  NOME_CLIENTE_ANONIMIZADO,
  TEXTO_REMOVIDO_LGPD,
} from '@gestao/shared-types';
import { AppModule } from '../../../app.module';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { ExclusaoContasAgendador } from './exclusao-contas.agendador';

const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * LGPD, ponta a ponta: o que o titular recebe, o que a anonimização apaga de
 * verdade (inclusive no histórico) e o ciclo de cancelamento até a exclusão.
 */
describe('LGPD (HTTP)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let agendador: ExclusaoContasAgendador;

  const marca = randomUUID().slice(0, 8);
  const senha = 'senhaSegura123';
  const tenantsCriados: string[] = [];

  interface Empresa {
    accessToken: string;
    tenantId: string;
    email: string;
    nome: string;
  }

  async function cadastrarEmpresa(sufixo: string): Promise<Empresa> {
    const nome = `Empresa ${sufixo} ${marca}`;
    const email = `${sufixo}+${marca}@exemplo.com`;

    const { body } = await request(app.getHttpServer())
      .post('/api/onboarding/cadastro')
      .send({ nomeEmpresa: nome, nomeResponsavel: 'Responsável', email, senha })
      .expect(201);

    tenantsCriados.push(body.usuario.tenantId);
    return { accessToken: body.accessToken, tenantId: body.usuario.tenantId, email, nome };
  }

  const comToken = (token: string) => ({
    get: (rota: string) =>
      request(app.getHttpServer()).get(rota).set('Authorization', `Bearer ${token}`),
    post: (rota: string) =>
      request(app.getHttpServer()).post(rota).set('Authorization', `Bearer ${token}`),
    patch: (rota: string) =>
      request(app.getHttpServer()).patch(rota).set('Authorization', `Bearer ${token}`),
  });

  beforeAll(async () => {
    const modulo: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = modulo.createNestApplication();
    app.setGlobalPrefix('api', { exclude: ['health'] });
    await app.init();

    prisma = modulo.get(PrismaService);
    agendador = modulo.get(ExclusaoContasAgendador);

    const slug = process.env.ONBOARDING_PLANO_PADRAO ?? 'essencial';
    await prisma.plano.upsert({
      where: { slug },
      create: { nome: 'Plano de teste', slug, preco: '0.00' },
      update: {},
    });
  });

  afterAll(async () => {
    for (const tenantId of tenantsCriados) {
      await prisma.comTenantExplicito(tenantId, async (tx) => {
        await tx.registroExclusaoConta.deleteMany({ where: { tenantId } });
        await tx.tenant.deleteMany({ where: { id: tenantId } });
      });
    }

    await app.close();
  });

  describe('pedidos do titular', () => {
    let empresa: Empresa;
    let outra: Empresa;
    let clienteId: string;
    const emailTitular = `maria.titular+${marca}@exemplo.com`;

    beforeAll(async () => {
      empresa = await cadastrarEmpresa('lgpd-titular');
      outra = await cadastrarEmpresa('lgpd-outra');
      const api = comToken(empresa.accessToken);

      const { body: cliente } = await api
        .post('/api/clientes')
        .send({
          nome: 'Maria Titular',
          email: emailTitular,
          telefone: '11912345678',
          documento: '12345678909',
          observacoes: 'Prefere contato à tarde',
        })
        .expect(201);
      clienteId = cliente.id;

      await api
        .post(`/api/clientes/${clienteId}/atendimentos`)
        .send({ descricao: 'Visita na casa da Maria', data: '2026-09-01' })
        .expect(201);

      await api
        .post('/api/orcamentos')
        .send({ clienteId, valor: '800,00', descricao: 'Troca de fiação da Maria' })
        .expect(201);

      await api
        .post('/api/lembretes')
        .send({ clienteId, canal: 'email', dataEnvio: '2030-01-01T10:00' })
        .expect(201);
    });

    it('entrega ao titular tudo o que o sistema guarda sobre ele', async () => {
      const { body } = await comToken(empresa.accessToken)
        .get(`/api/clientes/${clienteId}/dados-pessoais`)
        .expect(200);

      expect(body.empresa).toBe(empresa.nome);
      expect(body.cliente.email).toBe(emailTitular);
      expect(body.cliente.documento).toBe('12345678909');
      expect(body.atendimentos).toEqual([
        { data: '2026-09-01', descricao: 'Visita na casa da Maria' },
      ]);
      expect(body.orcamentos[0].valor).toBe('800.00');
      expect(body.lembretes).toHaveLength(1);
    });

    it('outra empresa não consegue ler nem anonimizar o cliente', async () => {
      const api = comToken(outra.accessToken);

      await api.get(`/api/clientes/${clienteId}/dados-pessoais`).expect(404);
      await api.post(`/api/clientes/${clienteId}/anonimizar`).expect(404);
    });

    it('anonimiza cadastro, texto livre, lembretes e histórico, mantendo os valores', async () => {
      const api = comToken(empresa.accessToken);

      await api.post(`/api/clientes/${clienteId}/anonimizar`).expect(204);

      const { body: cliente } = await api.get(`/api/clientes/${clienteId}`).expect(200);
      expect(cliente.nome).toBe(NOME_CLIENTE_ANONIMIZADO);
      expect(cliente.email).toBeNull();
      expect(cliente.telefone).toBeNull();
      expect(cliente.documento).toBeNull();
      expect(cliente.observacoes).toBeNull();
      expect(cliente.anonimizadoEm).not.toBeNull();

      const { body: dados } = await api
        .get(`/api/clientes/${clienteId}/dados-pessoais`)
        .expect(200);
      expect(dados.atendimentos[0].descricao).toBe(TEXTO_REMOVIDO_LGPD);
      expect(dados.orcamentos[0].descricao).toBeNull();
      expect(dados.orcamentos[0].valor).toBe('800.00');
      expect(dados.lembretes[0].status).toBe('cancelado');

      // A trilha de auditoria guardava o cadastro inteiro; nada dele pode sobrar.
      const logs = await prisma.comTenantExplicito(empresa.tenantId, (tx) =>
        tx.logAuditoria.findMany(),
      );
      const historico = JSON.stringify(logs);
      expect(historico).not.toContain('Maria');
      expect(historico).not.toContain(emailTitular);
      expect(historico).not.toContain('12345678909');
      expect(logs.some((log) => log.acao === 'anonimizou')).toBe(true);
    });

    it('tira o cliente da carteira', async () => {
      const { body } = await comToken(empresa.accessToken).get('/api/clientes').expect(200);

      expect(body.dados.map((item: { id: string }) => item.id)).not.toContain(clienteId);
    });

    it('recusa anonimizar de novo e editar o cadastro anonimizado', async () => {
      const api = comToken(empresa.accessToken);

      await api.post(`/api/clientes/${clienteId}/anonimizar`).expect(409);
      await api.patch(`/api/clientes/${clienteId}`).send({ nome: 'Maria de volta' }).expect(409);
    });
  });

  describe('exportação e cancelamento da conta', () => {
    let empresa: Empresa;

    beforeAll(async () => {
      empresa = await cadastrarEmpresa('lgpd-cancelar');
    });

    it('exporta os dados da empresa sem hash de senha', async () => {
      const { body } = await comToken(empresa.accessToken).get('/api/conta/exportar').expect(200);

      expect(body.empresa.nome).toBe(empresa.nome);
      expect(body.tabelas.usuarios[0].email).toBe(empresa.email);
      expect(JSON.stringify(body)).not.toContain('$argon2');
    });

    it('recusa quando o nome da empresa não confere', async () => {
      const { body } = await comToken(empresa.accessToken)
        .post('/api/conta/cancelar')
        .send({ nomeEmpresa: 'Outra empresa', senha })
        .expect(400);

      expect(body.detalhes).toHaveProperty('nomeEmpresa');
    });

    it('recusa com a senha errada', async () => {
      const { body } = await comToken(empresa.accessToken)
        .post('/api/conta/cancelar')
        .send({ nomeEmpresa: empresa.nome, senha: 'senhaErrada123' })
        .expect(400);

      expect(body.detalhes).toHaveProperty('senha');
    });

    it('cancela, derruba as sessões e fecha o login', async () => {
      const api = comToken(empresa.accessToken);

      const { body } = await api
        .post('/api/conta/cancelar')
        .send({ nomeEmpresa: `  ${empresa.nome.toUpperCase()} `, senha })
        .expect(200);
      expect(body.exclusaoPrevistaEm).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      const sessoes = await prisma.comTenantExplicito(empresa.tenantId, (tx) =>
        tx.refreshToken.count(),
      );
      expect(sessoes).toBe(0);

      const login = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: empresa.email, senha })
        .expect(402);
      expect(login.body.codigo).toBe(CODIGOS_ERRO.TENANT_SUSPENSO);

      await api.post('/api/conta/cancelar').send({ nomeEmpresa: empresa.nome, senha }).expect(409);
    });
  });

  describe('exclusão definitiva', () => {
    async function cancelarEm(tenantId: string, canceladoEm: Date): Promise<void> {
      await prisma.comTenantExplicito(tenantId, (tx) =>
        tx.tenant.update({ where: { id: tenantId }, data: { status: 'cancelado', canceladoEm } }),
      );
    }

    it('apaga só as contas vencidas e deixa o comprovante', async () => {
      const vencida = await cadastrarEmpresa('lgpd-vencida');
      const recente = await cadastrarEmpresa('lgpd-recente');

      await comToken(vencida.accessToken)
        .post('/api/clientes')
        .send({ nome: 'Cliente da conta vencida' })
        .expect(201);

      const canceladaHaMuito = new Date(
        Date.now() - (DIAS_PARA_EXCLUIR_CONTA_CANCELADA + 1) * DIA_MS,
      );
      await cancelarEm(vencida.tenantId, canceladaHaMuito);
      await cancelarEm(recente.tenantId, new Date());

      await agendador.excluirVencidas();

      const restoVencida = await prisma.comTenantExplicito(vencida.tenantId, async (tx) => ({
        tenant: await tx.tenant.findUnique({ where: { id: vencida.tenantId } }),
        clientes: await tx.cliente.count(),
        usuarios: await tx.usuario.count(),
        registro: await tx.registroExclusaoConta.findUnique({
          where: { tenantId: vencida.tenantId },
        }),
      }));

      expect(restoVencida.tenant).toBeNull();
      expect(restoVencida.clientes).toBe(0);
      expect(restoVencida.usuarios).toBe(0);
      expect(restoVencida.registro?.canceladoEm.toISOString()).toBe(canceladaHaMuito.toISOString());

      const recenteAinda = await prisma.comTenantExplicito(recente.tenantId, (tx) =>
        tx.tenant.findUnique({ where: { id: recente.tenantId } }),
      );
      expect(recenteAinda).not.toBeNull();
    });
  });
});
