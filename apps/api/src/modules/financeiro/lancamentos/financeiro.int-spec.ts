import { Test, type TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../../../app.module';
import { PrismaService } from '../../../infra/prisma/prisma.service';

/**
 * Financeiro, ponta a ponta.
 *
 * O foco está nos números: dinheiro que não fecha é o pior tipo de bug num
 * sistema de gestão, porque não trava nada — só faz o dono decidir preço com
 * base em conta errada.
 */
describe('financeiro (HTTP)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const marca = randomUUID().slice(0, 8);
  const tenantsCriados: string[] = [];

  let tokenA: string;
  let tokenB: string;
  let servicoId: string;
  let outroServicoId: string;
  let categoriaFixaId: string;

  const req = (token: string) => ({
    get: (rota: string) =>
      request(app.getHttpServer()).get(rota).set('Authorization', `Bearer ${token}`),
    post: (rota: string) =>
      request(app.getHttpServer()).post(rota).set('Authorization', `Bearer ${token}`),
    delete: (rota: string) =>
      request(app.getHttpServer()).delete(rota).set('Authorization', `Bearer ${token}`),
  });

  async function criarEmpresa(sufixo: string): Promise<string> {
    const { body } = await request(app.getHttpServer())
      .post('/api/onboarding/cadastro')
      .send({
        nomeEmpresa: `Fin ${sufixo} ${marca}`,
        nomeResponsavel: 'Responsável',
        email: `fin-${sufixo}+${marca}@exemplo.com`,
        senha: 'senhaSegura123',
      })
      .expect(201);

    tenantsCriados.push(body.usuario.tenantId);
    return body.accessToken;
  }

  /** Lança um valor e devolve a resposta. */
  const lancar = (dados: Record<string, unknown>) =>
    req(tokenA)
      .post('/api/financeiro/lancamentos')
      .send({ data: '2026-08-10', ...dados });

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

    const { body: servico } = await req(tokenA)
      .post('/api/servicos')
      .send({ nome: `Instalação ${marca}`, custoBase: '100,00' })
      .expect(201);
    servicoId = servico.id;

    const { body: outro } = await req(tokenA)
      .post('/api/servicos')
      .send({ nome: `Manutenção ${marca}`, custoBase: '50,00' })
      .expect(201);
    outroServicoId = outro.id;

    const { body: categoria } = await req(tokenA)
      .post('/api/financeiro/categorias')
      .send({ nome: `Aluguel ${marca}`, tipoCusto: 'fixo' })
      .expect(201);
    categoriaFixaId = categoria.id;
  });

  afterAll(async () => {
    for (const tenantId of tenantsCriados) {
      await prisma.comTenantExplicito(tenantId, (tx) =>
        tx.tenant.deleteMany({ where: { id: tenantId } }),
      );
    }
    await app.close();
  });

  describe('categorias', () => {
    it('recusa nome repetido', async () => {
      await req(tokenA)
        .post('/api/financeiro/categorias')
        .send({ nome: `Aluguel ${marca}`, tipoCusto: 'fixo' })
        .expect(409);
    });

    it('recusa excluir categoria em uso', async () => {
      await lancar({
        tipo: 'saida',
        descricao: 'Aluguel de agosto',
        valor: '2.000,00',
        categoriaId: categoriaFixaId,
      }).expect(201);

      // Apagar desvincularia registros do passado, e o relatório do mês
      // anterior mudaria sozinho.
      const resposta = await req(tokenA)
        .delete(`/api/financeiro/categorias/${categoriaFixaId}`)
        .expect(400);

      expect(resposta.body.mensagem).toMatch(/lançamento/i);
    });
  });

  describe('lançamentos', () => {
    it('converte o valor digitado em pt-BR e devolve decimal', async () => {
      const { body } = await lancar({
        tipo: 'entrada',
        descricao: 'Serviço prestado',
        valor: '1.234,56',
        servicoId,
      }).expect(201);

      expect(body.valor).toBe('1234.56');
    });

    it('grava a data informada, sem deslocamento de fuso', async () => {
      // `new Date('2026-08-10')` é UTC; no fuso do Brasil viraria 09/08 se o
      // servidor não fixasse a hora.
      const { body } = await lancar({
        tipo: 'saida',
        descricao: 'Material',
        valor: '300,00',
        data: '2026-08-10',
      }).expect(201);

      expect(body.data).toBe('2026-08-10');
    });

    it('recusa serviço inexistente', async () => {
      await lancar({
        tipo: 'entrada',
        descricao: 'Teste',
        valor: '100,00',
        servicoId: randomUUID(),
      }).expect(404);
    });

    it('separa pessoal de empresa', async () => {
      await lancar({
        tipo: 'saida',
        descricao: 'Almoço de domingo',
        valor: '150,00',
        natureza: 'pessoal',
      }).expect(201);

      const { body } = await req(tokenA)
        .get('/api/financeiro/lancamentos?natureza=pessoal')
        .expect(200);

      expect(body.meta.total).toBe(1);
    });
  });

  describe('fluxo de caixa', () => {
    it('soma entradas, saídas e saldo do período', async () => {
      const { body } = await req(tokenA)
        .get('/api/financeiro/fluxo-de-caixa?de=2026-08-01&ate=2026-08-31')
        .expect(200);

      // Formato decimal com duas casas, sempre — nunca notação científica.
      expect(body.entradas).toMatch(/^\d+\.\d{2}$/);
      expect(body.saidas).toMatch(/^\d+\.\d{2}$/);

      const conferido = (Number(body.entradas) - Number(body.saidas)).toFixed(2);
      expect(body.saldo).toBe(conferido);
    });

    it('não inclui lançamentos pessoais no caixa da empresa', async () => {
      // O almoço de domingo (R$ 150 pessoais) não pode entrar no custo
      // operacional — distorceria a margem e a decisão de preço.
      const { body } = await req(tokenA)
        .get('/api/financeiro/fluxo-de-caixa?de=2026-08-01&ate=2026-08-31')
        .expect(200);

      const { body: comPessoal } = await req(tokenA)
        .get('/api/financeiro/fluxo-de-caixa?de=2026-08-01&ate=2026-08-31&natureza=pessoal')
        .expect(200);

      expect(comPessoal.saidas).toBe('150.00');
      expect(Number(body.saidas)).not.toBe(Number(comPessoal.saidas));
    });

    it('separa custo fixo de variável pela categoria', async () => {
      const { body } = await req(tokenA)
        .get('/api/financeiro/fluxo-de-caixa?de=2026-08-01&ate=2026-08-31')
        .expect(200);

      // O aluguel de R$ 2.000 está categorizado como fixo.
      expect(body.custoFixo).toBe('2000.00');
    });

    it('ignora período fora do intervalo', async () => {
      const { body } = await req(tokenA)
        .get('/api/financeiro/fluxo-de-caixa?de=2026-09-01&ate=2026-09-30')
        .expect(200);

      expect(body.entradas).toBe('0.00');
      expect(body.saldo).toBe('0.00');
    });
  });

  describe('margem por serviço', () => {
    it('calcula receita menos custo direto, por serviço', async () => {
      // Um serviço com números redondos, para a conta ser conferível a olho.
      await lancar({
        tipo: 'entrada',
        descricao: 'Manutenção vendida',
        valor: '1.000,00',
        servicoId: outroServicoId,
      }).expect(201);

      await lancar({
        tipo: 'saida',
        descricao: 'Peças da manutenção',
        valor: '400,00',
        servicoId: outroServicoId,
      }).expect(201);

      const { body } = await req(tokenA)
        .get('/api/financeiro/margem?de=2026-08-01&ate=2026-08-31')
        .expect(200);

      const item = body.itens.find((i: { servicoId: string }) => i.servicoId === outroServicoId);

      expect(item.receita).toBe('1000.00');
      expect(item.custo).toBe('400.00');
      expect(item.margem).toBe('600.00');
      expect(item.margemPercentual).toBe(60);
    });

    it('ordena da maior margem para a menor', async () => {
      // A pergunta que o relatório responde é "o que dá mais lucro?".
      const { body } = await req(tokenA)
        .get('/api/financeiro/margem?de=2026-08-01&ate=2026-08-31')
        .expect(200);

      const margens = body.itens.map((i: { margem: string }) => Number(i.margem));
      const ordenadas = [...margens].sort((a, b) => b - a);

      expect(margens).toEqual(ordenadas);
    });

    it('reporta à parte a receita sem serviço vinculado', async () => {
      await lancar({
        tipo: 'entrada',
        descricao: 'Venda avulsa',
        valor: '500,00',
      }).expect(201);

      const { body } = await req(tokenA)
        .get('/api/financeiro/margem?de=2026-08-01&ate=2026-08-31')
        .expect(200);

      // Uma lacuna visível é melhor que um número silenciosamente incompleto.
      expect(body.receitaSemServico).toBe('500.00');
    });

    it('não calcula percentual quando não houve receita', async () => {
      // Dividir por zero não é "margem zero", é pergunta sem resposta.
      const { body: servico } = await req(tokenA)
        .post('/api/servicos')
        .send({ nome: `Só custo ${marca}`, custoBase: '10,00' })
        .expect(201);

      await lancar({
        tipo: 'saida',
        descricao: 'Custo sem receita',
        valor: '80,00',
        servicoId: servico.id,
      }).expect(201);

      const { body } = await req(tokenA)
        .get('/api/financeiro/margem?de=2026-08-01&ate=2026-08-31')
        .expect(200);

      const item = body.itens.find((i: { servicoId: string }) => i.servicoId === servico.id);

      expect(item.margemPercentual).toBeNull();
      expect(item.margem).toBe('-80.00');
    });
  });

  describe('acesso e isolamento', () => {
    it('não expõe o financeiro de outra empresa', async () => {
      const { body } = await req(tokenB)
        .get('/api/financeiro/fluxo-de-caixa?de=2026-08-01&ate=2026-08-31')
        .expect(200);

      expect(body.entradas).toBe('0.00');
      expect(body.saidas).toBe('0.00');
    });

    it('a margem de uma empresa não soma valores da outra', async () => {
      const { body } = await req(tokenB)
        .get('/api/financeiro/margem?de=2026-08-01&ate=2026-08-31')
        .expect(200);

      expect(body.itens).toHaveLength(0);
      expect(body.receitaSemServico).toBe('0.00');
    });

    it('recusa quem tem papel de atendente', async () => {
      // O dono precisa poder dar acesso ao sistema sem expor o quanto ganha.
      const tenantId = tenantsCriados[0]!;

      await prisma.comTenantExplicito(tenantId, (tx) =>
        tx.usuario.updateMany({ where: { tenantId }, data: { papel: 'atendente' } }),
      );

      const { body: sessao } = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: `fin-a+${marca}@exemplo.com`, senha: 'senhaSegura123' })
        .expect(200);

      await request(app.getHttpServer())
        .get('/api/financeiro/lancamentos')
        .set('Authorization', `Bearer ${sessao.accessToken}`)
        .expect(403);

      // Devolve o papel para não afetar outros testes do arquivo.
      await prisma.comTenantExplicito(tenantId, (tx) =>
        tx.usuario.updateMany({ where: { tenantId }, data: { papel: 'admin' } }),
      );
    });
  });
});
