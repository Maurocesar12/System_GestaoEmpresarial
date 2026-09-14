import { Test, type TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../../../app.module';
import { PrismaService } from '../../../infra/prisma/prisma.service';

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/**
 * Entrada de leads e lista de reativação, ponta a ponta.
 *
 * As duas listas não têm tabela própria: são leituras derivadas do cliente e do
 * que está pendurado nele. É exatamente por isso que elas precisam de teste de
 * integração — o que decide a situação de um lead são os `where` com relação
 * (`none`, `some`), que nenhum teste unitário exercita de verdade.
 *
 * Algumas datas são recuadas direto no banco. Não há como esperar sessenta dias
 * numa suíte, e criar um endpoint de "cadastrar no passado" só para testar seria
 * abrir no produto uma porta que ninguém pediu.
 */
describe('leads (HTTP)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const marca = randomUUID().slice(0, 8);
  const tenantsCriados: string[] = [];

  let tokenA: string;
  let tokenB: string;
  let tenantA: string;

  async function criarEmpresa(sufixo: string): Promise<{ token: string; tenantId: string }> {
    const { body } = await request(app.getHttpServer())
      .post('/api/onboarding/cadastro')
      .send({
        nomeEmpresa: `Leads ${sufixo} ${marca}`,
        nomeResponsavel: 'Responsável',
        email: `leads-${sufixo}+${marca}@exemplo.com`,
        senha: 'senhaSegura123',
      })
      .expect(201);

    tenantsCriados.push(body.usuario.tenantId);
    return { token: body.accessToken, tenantId: body.usuario.tenantId };
  }

  const comToken = (token: string) => ({
    get: (rota: string) =>
      request(app.getHttpServer()).get(rota).set('Authorization', `Bearer ${token}`),
    post: (rota: string) =>
      request(app.getHttpServer()).post(rota).set('Authorization', `Bearer ${token}`),
    patch: (rota: string) =>
      request(app.getHttpServer()).patch(rota).set('Authorization', `Bearer ${token}`),
  });

  async function criarCliente(token: string, nome: string): Promise<string> {
    const { body } = await comToken(token).post('/api/clientes').send({ nome }).expect(201);
    return body.id;
  }

  /** Recua o cadastro do cliente no tempo, para ele poder esfriar. */
  async function envelhecerCliente(clienteId: string, dias: number): Promise<void> {
    await prisma.comTenantExplicito(tenantA, (tx) =>
      tx.cliente.update({
        where: { id: clienteId },
        data: { criadoEm: new Date(Date.now() - dias * MS_POR_DIA) },
      }),
    );
  }

  async function envelhecerOrcamento(orcamentoId: string, dias: number): Promise<void> {
    await prisma.comTenantExplicito(tenantA, (tx) =>
      tx.orcamento.update({
        where: { id: orcamentoId },
        data: { criadoEm: new Date(Date.now() - dias * MS_POR_DIA) },
      }),
    );
  }

  async function criarOrcamento(token: string, clienteId: string, valor: string): Promise<string> {
    const { body } = await comToken(token)
      .post('/api/orcamentos')
      .send({ clienteId, valor, descricao: 'Proposta de teste' })
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

    const empresaA = await criarEmpresa('a');
    const empresaB = await criarEmpresa('b');
    tokenA = empresaA.token;
    tenantA = empresaA.tenantId;
    tokenB = empresaB.token;
  });

  afterAll(async () => {
    for (const tenantId of tenantsCriados) {
      await prisma.comTenantExplicito(tenantId, (tx) =>
        tx.tenant.deleteMany({ where: { id: tenantId } }),
      );
    }
    await app.close();
  });

  describe('fila de entrada', () => {
    it('todo cliente recém-cadastrado entra aguardando contato', async () => {
      const nome = `Lead Novo ${marca}`;
      await criarCliente(tokenA, nome);

      const { body } = await comToken(tokenA).get('/api/leads').expect(200);
      const lead = body.leads.find((item: { nome: string }) => item.nome === nome);

      expect(lead).toBeDefined();
      expect(lead.situacao).toBe('aguardando');
      expect(lead.primeiroContatoEm).toBeNull();
      expect(body.resumo.hoje).toBeGreaterThanOrEqual(1);
    });

    it('registrar um atendimento tira o lead da fila de espera', async () => {
      const nome = `Lead Atendido ${marca}`;
      const clienteId = await criarCliente(tokenA, nome);

      await comToken(tokenA)
        .post(`/api/clientes/${clienteId}/atendimentos`)
        .send({ descricao: 'Ligação de apresentação', data: hoje() })
        .expect(201);

      const { body } = await comToken(tokenA).get('/api/leads').expect(200);
      const lead = body.leads.find((item: { nome: string }) => item.nome === nome);

      expect(lead.situacao).toBe('em_contato');
      expect(lead.primeiroContatoEm).not.toBeNull();
    });

    it('a proposta emitida e a aprovada mudam a situação sozinhas', async () => {
      const nome = `Lead Proposta ${marca}`;
      const clienteId = await criarCliente(tokenA, nome);
      const orcamentoId = await criarOrcamento(tokenA, clienteId, '1500.00');

      const emAberto = await comToken(tokenA).get('/api/leads').expect(200);
      const comProposta = emAberto.body.leads.find((item: { nome: string }) => item.nome === nome);

      expect(comProposta.situacao).toBe('com_proposta');
      expect(comProposta.orcamentoAberto.valor).toBe('1500.00');

      await comToken(tokenA)
        .post(`/api/orcamentos/${orcamentoId}/status`)
        .send({ acao: 'aprovar' })
        .expect(201);

      const depois = await comToken(tokenA).get('/api/leads').expect(200);
      const ganho = depois.body.leads.find((item: { nome: string }) => item.nome === nome);

      expect(ganho.situacao).toBe('ganho');
      expect(ganho.orcamentoAberto).toBeNull();
    });

    it('filtra por situação sem misturar os outros leads', async () => {
      const { body } = await comToken(tokenA).get('/api/leads?situacao=aguardando').expect(200);

      expect(body.leads.length).toBeGreaterThan(0);
      for (const lead of body.leads) {
        expect(lead.situacao).toBe('aguardando');
      }
    });

    it('o resumo soma o valor das propostas em aberto do período', async () => {
      const clienteId = await criarCliente(tokenA, `Lead Valor ${marca}`);
      await criarOrcamento(tokenA, clienteId, '2000.00');

      const { body } = await comToken(tokenA).get('/api/leads').expect(200);

      expect(Number(body.resumo.valorEmProposta)).toBeGreaterThanOrEqual(2000);
      expect(body.resumo.comProposta).toBeGreaterThanOrEqual(1);
    });

    it('cliente antigo não aparece na janela de chegada', async () => {
      const nome = `Lead Antigo ${marca}`;
      const clienteId = await criarCliente(tokenA, nome);
      await envelhecerCliente(clienteId, 45);

      const { body } = await comToken(tokenA).get('/api/leads?dias=30').expect(200);
      expect(body.leads.find((item: { nome: string }) => item.nome === nome)).toBeUndefined();

      const { body: janelaMaior } = await comToken(tokenA).get('/api/leads?dias=90').expect(200);
      expect(janelaMaior.leads.find((item: { nome: string }) => item.nome === nome)).toBeDefined();
    });

    it('uma empresa não enxerga os leads da outra', async () => {
      const { body } = await comToken(tokenB).get('/api/leads').expect(200);

      expect(body.leads).toHaveLength(0);
      expect(body.resumo.noPeriodo).toBe(0);
    });
  });

  describe('lista de reativação', () => {
    it('cliente sem nenhum toque há tempo demais entra como nunca fechou', async () => {
      const nome = `Frio Sem Nada ${marca}`;
      const clienteId = await criarCliente(tokenA, nome);
      await envelhecerCliente(clienteId, 120);

      const { body } = await comToken(tokenA).get('/api/leads/reativacao?dias=60').expect(200);
      const frio = body.clientes.find((item: { nome: string }) => item.nome === nome);

      expect(frio).toBeDefined();
      expect(frio.motivo).toBe('nunca_fechou');
      expect(frio.diasSemContato).toBeGreaterThanOrEqual(119);
      expect(frio.valorHistorico).toBe('0.00');
    });

    it('quem já comprou vem primeiro, com o histórico somado', async () => {
      const nome = `Frio Que Comprou ${marca}`;
      const clienteId = await criarCliente(tokenA, nome);
      const orcamentoId = await criarOrcamento(tokenA, clienteId, '5000.00');

      await comToken(tokenA)
        .post(`/api/orcamentos/${orcamentoId}/status`)
        .send({ acao: 'aprovar' })
        .expect(201);

      await envelhecerCliente(clienteId, 150);
      await envelhecerOrcamento(orcamentoId, 150);

      const { body } = await comToken(tokenA).get('/api/leads/reativacao?dias=60').expect(200);

      expect(body.clientes[0].nome).toBe(nome);
      expect(body.clientes[0].motivo).toBe('comprou_e_sumiu');
      expect(body.clientes[0].valorHistorico).toBe('5000.00');
      expect(body.clientes[0].servicosFechados).toBe(1);
      expect(body.resumo.porMotivo.map((item: { motivo: string }) => item.motivo)).toContain(
        'comprou_e_sumiu',
      );
    });

    it('proposta em aberto mantém o cliente fora da lista, por mais antiga que seja', async () => {
      const nome = `Frio Com Proposta ${marca}`;
      const clienteId = await criarCliente(tokenA, nome);
      const orcamentoId = await criarOrcamento(tokenA, clienteId, '800.00');

      await envelhecerCliente(clienteId, 200);
      await envelhecerOrcamento(orcamentoId, 200);

      const { body } = await comToken(tokenA).get('/api/leads/reativacao?dias=60').expect(200);

      // Negociação viva não é cliente frio: ele aparece nas propostas em aberto,
      // e sugerir "reative" aqui seria mandar ligar para quem já está em conversa.
      expect(body.clientes.find((item: { nome: string }) => item.nome === nome)).toBeUndefined();
    });

    it('follow-up já marcado tira o cliente da fila', async () => {
      const nome = `Frio Com Retorno ${marca}`;
      const clienteId = await criarCliente(tokenA, nome);
      await envelhecerCliente(clienteId, 200);

      const antes = await comToken(tokenA).get('/api/leads/reativacao?dias=60').expect(200);
      expect(
        antes.body.clientes.find((item: { nome: string }) => item.nome === nome),
      ).toBeDefined();

      await comToken(tokenA)
        .post('/api/lembretes')
        .send({ clienteId, canal: 'email', dataEnvio: amanhaAsDez() })
        .expect(201);

      const depois = await comToken(tokenA).get('/api/leads/reativacao?dias=60').expect(200);
      expect(
        depois.body.clientes.find((item: { nome: string }) => item.nome === nome),
      ).toBeUndefined();
    });

    it('filtra por motivo e mantém o total coerente com a lista', async () => {
      const { body } = await comToken(tokenA)
        .get('/api/leads/reativacao?dias=60&motivo=comprou_e_sumiu')
        .expect(200);

      expect(body.clientes.length).toBeGreaterThan(0);
      for (const cliente of body.clientes) {
        expect(cliente.motivo).toBe('comprou_e_sumiu');
      }
      expect(body.resumo.total).toBe(body.resumo.analisados);
    });

    it('a lista de uma empresa não alcança clientes da outra', async () => {
      const { body } = await comToken(tokenB).get('/api/leads/reativacao?dias=60').expect(200);

      expect(body.clientes).toHaveLength(0);
      expect(body.resumo.total).toBe(0);
    });
  });
});

function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}

/** O formato que o campo de lembrete aceita: `AAAA-MM-DDTHH:mm`, sem fuso. */
function amanhaAsDez(): string {
  return `${new Date(Date.now() + MS_POR_DIA).toISOString().slice(0, 10)}T10:00`;
}
