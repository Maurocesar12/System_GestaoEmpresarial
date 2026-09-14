import { Test, type TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../infra/prisma/prisma.service';

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/**
 * Painel em tempo real, ponta a ponta.
 *
 * O painel é a tela que mais gente abre e a que mais junta módulos: leads,
 * funil, comercial, agenda, follow-ups, reativação, caixa e histórico saem da
 * **mesma transação**. Um teste de unidade por bloco não pegaria o que mais
 * importa aqui — que a soma de tudo continua respondendo, com o recorte do
 * tenant certo, depois de qualquer mexida em qualquer um dos módulos.
 */
describe('painel (HTTP)', () => {
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
        nomeEmpresa: `Painel ${sufixo} ${marca}`,
        nomeResponsavel: 'Responsável',
        email: `painel-${sufixo}+${marca}@exemplo.com`,
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
  });

  const painelDe = async (token: string) => {
    const { body } = await comToken(token).get('/api/painel/tempo-real').expect(200);
    return body;
  };

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

  it('empresa recém-criada responde com tudo zerado, e não com erro', async () => {
    const painel = await painelDe(tokenB);

    expect(painel.totalClientes).toBe(0);
    expect(painel.leads.hoje).toBe(0);
    expect(painel.funil.etapas).toHaveLength(7);
    expect(painel.comercial.abertos.quantidade).toBe(0);
    expect(painel.alertas).toEqual([]);
  });

  it('carimba o instante da leitura e diz de quanto em quanto tempo recarregar', async () => {
    const painel = await painelDe(tokenA);

    // A tela conta "atualizado há Xs" a partir daqui, então este campo precisa
    // ser uma data válida — e não a string vazia que um `toISOString` esquecido
    // produziria.
    expect(Number.isNaN(Date.parse(painel.geradoEm))).toBe(false);
    expect(painel.recarregarEmSegundos).toBeGreaterThan(0);
  });

  it('o admin recebe todos os blocos, porque tem todas as permissões', async () => {
    const painel = await painelDe(tokenA);

    for (const bloco of [
      'leads',
      'funil',
      'comercial',
      'agenda',
      'followUps',
      'reativacao',
      'financeiro',
    ]) {
      expect(painel[bloco]).not.toBeNull();
    }
  });

  it('um cliente novo aparece na entrada de leads e no total da carteira', async () => {
    const nome = `Cliente Painel ${marca}`;
    await comToken(tokenA).post('/api/clientes').send({ nome }).expect(201);

    const painel = await painelDe(tokenA);

    expect(painel.totalClientes).toBe(1);
    expect(painel.leads.hoje).toBe(1);
    expect(painel.leads.aguardandoContato).toBe(1);
    expect(painel.leads.ultimos[0].nome).toBe(nome);
    expect(painel.funil.total).toBe(1);
  });

  it('a proposta emitida aparece no comercial e no valor da etapa do funil', async () => {
    const { body: cliente } = await comToken(tokenA)
      .post('/api/clientes')
      .send({ nome: `Cliente Proposta ${marca}` })
      .expect(201);

    await comToken(tokenA)
      .post('/api/orcamentos')
      .send({ clienteId: cliente.id, valor: '3200.00', descricao: 'Proposta do painel' })
      .expect(201);

    const painel = await painelDe(tokenA);

    expect(painel.comercial.abertos.quantidade).toBe(1);
    expect(painel.comercial.abertos.valor).toBe('3200.00');
    expect(painel.leads.valorEmProposta).toBe('3200.00');

    // O valor entra na etapa onde o cliente está — a automação o levou para a
    // etapa marcada como "orçamento enviado".
    const comValor = painel.funil.etapas.filter(
      (etapa: { valor: string }) => Number(etapa.valor) > 0,
    );
    expect(comValor).toHaveLength(1);
    expect(comValor[0].valor).toBe('3200.00');
  });

  it('lead esquecido há mais de um dia vira alerta com link para a fila', async () => {
    const { body: cliente } = await comToken(tokenA)
      .post('/api/clientes')
      .send({ nome: `Cliente Esquecido ${marca}` })
      .expect(201);

    await prisma.comTenantExplicito(tenantA, (tx) =>
      tx.cliente.update({
        where: { id: cliente.id },
        data: { criadoEm: new Date(Date.now() - 3 * MS_POR_DIA) },
      }),
    );

    const painel = await painelDe(tokenA);
    const alerta = painel.alertas.find((item: { id: string }) => item.id === 'leads-sem-contato');

    expect(alerta).toBeDefined();
    expect(alerta.tom).toBe('perigo');
    expect(alerta.href).toContain('/painel/leads');
    expect(painel.leads.semContatoNoPrazo).toBeGreaterThanOrEqual(1);
  });

  it('o feed traz o que acabou de acontecer, com o nome de quem fez', async () => {
    const painel = await painelDe(tokenA);

    expect(painel.atividade.length).toBeGreaterThan(0);
    expect(painel.atividade[0].usuarioNome).toBe('Responsável');
    expect(painel.atividade[0].resumo).toContain('Cliente');
  });

  it('o painel de uma empresa nunca conta o movimento da outra', async () => {
    const painel = await painelDe(tokenB);

    expect(painel.totalClientes).toBe(0);
    expect(painel.leads.ultimos).toEqual([]);
    expect(painel.comercial.abertos.valor).toBe('0.00');
    expect(painel.atividade).toEqual([]);
  });
});
