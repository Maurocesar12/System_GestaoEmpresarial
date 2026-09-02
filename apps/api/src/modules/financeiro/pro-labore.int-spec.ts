import { Test, type TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { primeiroDiaDeMesesAtras, ultimoDiaDoMesPassado } from './datas';

/**
 * Pró-labore e reserva, ponta a ponta.
 *
 * Os dois existem para responder "quanto posso tirar" e "quanto tempo eu
 * aguento". São números que o dono usa para decidir a própria retirada, então o
 * que se testa aqui é sobretudo que a conta não mente: que a média usa só meses
 * fechados, que o aporte da reserva é descontado do teto, e que o histórico de
 * vigência preserva o passado.
 */
describe('pró-labore e reservas (HTTP)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const marca = randomUUID().slice(0, 8);
  const tenantsCriados: string[] = [];

  let tokenA: string;
  let tokenB: string;

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
        nomeEmpresa: `Prolab ${sufixo} ${marca}`,
        nomeResponsavel: 'Responsável',
        email: `prolab-${sufixo}+${marca}@exemplo.com`,
        senha: 'senhaSegura123',
      })
      .expect(201);

    tenantsCriados.push(body.usuario.tenantId);
    return body.accessToken;
  }

  // Uma data dentro da janela que a sugestão analisa: meses fechados, sem o
  // corrente. Calculada com os mesmos helpers do serviço para o teste não
  // quebrar sozinho na virada do mês.
  const dentroDaJanela = ultimoDiaDoMesPassado();

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

  describe('vigências', () => {
    it('fecha a vigência anterior ao definir um valor novo', async () => {
      await req(tokenA)
        .post('/api/financeiro/pro-labore')
        .send({ valor: '4.000,00', vigenciaInicio: '2026-01-01' })
        .expect(201);

      await req(tokenA)
        .post('/api/financeiro/pro-labore')
        .send({ valor: '5.000,00', vigenciaInicio: '2026-07-01' })
        .expect(201);

      const { body } = await req(tokenA).get('/api/financeiro/pro-labore').expect(200);

      // Mais recente primeiro.
      expect(body).toHaveLength(2);
      expect(body[0].valor).toBe('5000.00');
      expect(body[0].vigenciaFim).toBeNull();

      // O anterior fecha um dia antes do novo começar — nunca no mesmo dia, ou
      // os dois valeriam na virada.
      expect(body[1].valor).toBe('4000.00');
      expect(body[1].vigenciaFim).toBe('2026-06-30');
    });

    it('converte o valor digitado em pt-BR', async () => {
      const { body } = await req(tokenA)
        .post('/api/financeiro/pro-labore')
        .send({ valor: '1.234,56', vigenciaInicio: '2026-08-01' })
        .expect(201);

      expect(body.valor).toBe('1234.56');
    });

    it('recusa duas vigências com a mesma data de início', async () => {
      await req(tokenA)
        .post('/api/financeiro/pro-labore')
        .send({ valor: '9.000,00', vigenciaInicio: '2026-08-01' })
        .expect(400);
    });

    it('reabre a vigência anterior ao remover a atual', async () => {
      const { body: antes } = await req(tokenA).get('/api/financeiro/pro-labore').expect(200);
      const atual = antes[0];

      await req(tokenA).delete(`/api/financeiro/pro-labore/${atual.id}`).expect(204);

      const { body: depois } = await req(tokenA).get('/api/financeiro/pro-labore').expect(200);

      // Sem reabrir, a empresa ficaria com histórico e sem valor vigente.
      expect(depois[0].vigenciaFim).toBeNull();
      expect(depois[0].valor).toBe('5000.00');
    });

    it('devolve como vigente o valor da data de hoje', async () => {
      const { body } = await req(tokenA).get('/api/financeiro/pro-labore/vigente').expect(200);

      expect(body.valor).toBe('5000.00');
    });
  });

  describe('sugestão de teto', () => {
    it('usa a média das entradas recebidas nos meses fechados', async () => {
      // 3 meses de janela, R$ 9.000 recebidos => média de R$ 3.000.
      await req(tokenA)
        .post('/api/financeiro/lancamentos')
        .send({
          tipo: 'entrada',
          descricao: 'Serviço prestado',
          valor: '9.000,00',
          data: dentroDaJanela,
          pagoEm: dentroDaJanela,
        })
        .expect(201);

      const { body } = await req(tokenA)
        .get('/api/financeiro/pro-labore/sugestao?meses=3')
        .expect(200);

      expect(body.mediaReceita).toBe('3000.00');
      expect(body.mesesAnalisados).toBe(3);
    });

    it('desconta custo fixo e aporte de reserva do teto', async () => {
      const { body: categoria } = await req(tokenA)
        .post('/api/financeiro/categorias')
        .send({ nome: `Aluguel ${marca}`, tipoCusto: 'fixo' })
        .expect(201);

      // R$ 3.000 de custo fixo na janela => R$ 1.000/mês.
      await req(tokenA)
        .post('/api/financeiro/lancamentos')
        .send({
          tipo: 'saida',
          descricao: 'Aluguel',
          valor: '3.000,00',
          data: dentroDaJanela,
          pagoEm: dentroDaJanela,
          categoriaId: categoria.id,
        })
        .expect(201);

      // Reserva com R$ 12.000 faltando para a meta => R$ 1.000/mês de aporte.
      await req(tokenA)
        .post('/api/financeiro/reservas')
        .send({ nome: `Emergência ${marca}`, valorAtual: '0,00', meta: '12.000,00' })
        .expect(201);

      const { body } = await req(tokenA)
        .get('/api/financeiro/pro-labore/sugestao?meses=3')
        .expect(200);

      expect(body.custoFixoMensal).toBe('1000.00');
      expect(body.aporteReservaSugerido).toBe('1000.00');

      // 3000 − 1000 de fixo − 0 de variável − 1000 de aporte = 1000.
      expect(body.tetoSugerido).toBe('1000.00');

      // Retirada vigente de 5.000 contra teto de 1.000: folga negativa. É o
      // recado principal da tela — está retirando acima do que sustenta.
      expect(Number(body.folga)).toBeLessThan(0);
    });

    it('ignora o mês corrente na média', async () => {
      // Um valor alto lançado hoje não pode inflar a sugestão: o mês corrente
      // está pela metade, e incluí-lo distorceria o teto todo dia 1º.
      const hoje = new Date().toISOString().slice(0, 10);

      await req(tokenA)
        .post('/api/financeiro/lancamentos')
        .send({
          tipo: 'entrada',
          descricao: 'Recebido hoje',
          valor: '90.000,00',
          data: hoje,
          pagoEm: hoje,
        })
        .expect(201);

      const { body } = await req(tokenA)
        .get('/api/financeiro/pro-labore/sugestao?meses=3')
        .expect(200);

      expect(body.mediaReceita).toBe('3000.00');
    });

    it('nunca sugere teto negativo', async () => {
      const { body } = await req(tokenB)
        .get('/api/financeiro/pro-labore/sugestao?meses=3')
        .expect(200);

      // Empresa sem movimento: o teto é zero, não um número negativo — que
      // seria lido como "retire menos que nada".
      expect(body.tetoSugerido).toBe('0.00');
      expect(body.valorVigente).toBeNull();
    });
  });

  describe('reservas', () => {
    let reservaId: string;

    it('calcula o percentual da meta', async () => {
      const { body } = await req(tokenB)
        .post('/api/financeiro/reservas')
        .send({ nome: `Fundo ${marca}`, valorAtual: '2.500,00', meta: '10.000,00' })
        .expect(201);

      reservaId = body.id;
      expect(body.percentualDaMeta).toBe(25);
    });

    it('soma um aporte ao saldo', async () => {
      const { body } = await req(tokenB)
        .post(`/api/financeiro/reservas/${reservaId}/movimentar`)
        .send({ tipo: 'aporte', valor: '500,00' })
        .expect(201);

      expect(body.valorAtual).toBe('3000.00');
    });

    it('recusa resgate maior que o guardado', async () => {
      const resposta = await req(tokenB)
        .post(`/api/financeiro/reservas/${reservaId}/movimentar`)
        .send({ tipo: 'resgate', valor: '99.000,00' })
        .expect(400);

      expect(resposta.body.mensagem).toMatch(/resgatar/i);
    });

    it('recusa nome repetido', async () => {
      await req(tokenB)
        .post('/api/financeiro/reservas')
        .send({ nome: `Fundo ${marca}`, valorAtual: '0,00' })
        .expect(409);
    });

    it('não calcula percentual quando não há meta', async () => {
      const { body } = await req(tokenB)
        .post('/api/financeiro/reservas')
        .send({ nome: `Sem meta ${marca}`, valorAtual: '100,00' })
        .expect(201);

      expect(body.meta).toBeNull();
      expect(body.percentualDaMeta).toBeNull();
    });

    it('não calcula cobertura sem custo fixo registrado', async () => {
      const { body } = await req(tokenB).get('/api/financeiro/reservas').expect(200);

      // Dividir por zero não é "cobertura infinita", é pergunta sem resposta.
      expect(body.mesesDeCobertura).toBeNull();
      expect(body.totalGuardado).toBe('3100.00');
    });

    it('traduz o saldo em meses de custo fixo', async () => {
      // A empresa A tem R$ 1.000/mês de custo fixo (teste anterior).
      const { body } = await req(tokenA).get('/api/financeiro/reservas').expect(200);

      expect(body.custoFixoMensal).toBe('1000.00');
      expect(body.mesesDeCobertura).toBe(0);
    });
  });

  describe('acesso e isolamento', () => {
    it('não expõe o pró-labore de outra empresa', async () => {
      const { body } = await req(tokenB).get('/api/financeiro/pro-labore').expect(200);

      expect(body).toHaveLength(0);
    });

    it('não soma a reserva de outra empresa', async () => {
      const { body } = await req(tokenA).get('/api/financeiro/reservas').expect(200);

      const nomes = body.reservas.map((r: { nome: string }) => r.nome);
      expect(nomes).not.toContain(`Fundo ${marca}`);
    });

    it('recusa quem tem papel de atendente', async () => {
      // A retirada do dono é justamente o número que ele não quer expor ao dar
      // acesso ao sistema.
      const tenantId = tenantsCriados[0]!;

      await prisma.comTenantExplicito(tenantId, (tx) =>
        tx.usuario.updateMany({ where: { tenantId }, data: { papel: 'atendente' } }),
      );

      const { body: sessao } = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: `prolab-a+${marca}@exemplo.com`, senha: 'senhaSegura123' })
        .expect(200);

      await request(app.getHttpServer())
        .get('/api/financeiro/pro-labore')
        .set('Authorization', `Bearer ${sessao.accessToken}`)
        .expect(403);

      await prisma.comTenantExplicito(tenantId, (tx) =>
        tx.usuario.updateMany({ where: { tenantId }, data: { papel: 'admin' } }),
      );
    });
  });

  it('a janela de análise cobre meses fechados', () => {
    // Guarda a premissa dos testes de média acima: se os helpers mudarem, este
    // teste falha antes de os números começarem a mentir em silêncio.
    const inicio = primeiroDiaDeMesesAtras(3);
    const fim = ultimoDiaDoMesPassado();

    expect(inicio < fim).toBe(true);
    expect(inicio.endsWith('-01')).toBe(true);
    expect(fim < new Date().toISOString().slice(0, 10)).toBe(true);
  });
});
