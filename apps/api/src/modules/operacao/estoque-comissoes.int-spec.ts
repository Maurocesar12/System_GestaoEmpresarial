import { Test, type TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { PERMISSOES } from '@gestao/shared-types';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../infra/prisma/prisma.service';

/**
 * Estoque e comissões, ponta a ponta: da compra do material até a margem do
 * serviço e a conta a pagar da comissão.
 */
describe('estoque e comissões (HTTP)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const marca = randomUUID().slice(0, 8);
  const tenantsCriados: string[] = [];
  const PERIODO = 'de=2000-01-01&ate=2100-12-31';

  let token: string;
  let tokenOutra: string;
  let usuarioId: string;
  let materialId: string;
  let servicoId: string;
  let clienteId: string;
  let orcamentoId: string;

  async function cadastrarEmpresa(sufixo: string) {
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
    return { accessToken: body.accessToken as string, usuarioId: body.usuario.id as string };
  }

  const api = (metodo: 'get' | 'post' | 'put' | 'patch', rota: string, comToken = token) =>
    request(app.getHttpServer())[metodo](rota).set('Authorization', `Bearer ${comToken}`);

  const material = async () => (await api('get', `/api/estoque/materiais/${materialId}`).expect(200)).body;

  beforeAll(async () => {
    const modulo: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();

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

    const empresa = await cadastrarEmpresa('operacao');
    token = empresa.accessToken;
    usuarioId = empresa.usuarioId;
    tokenOutra = (await cadastrarEmpresa('operacao-outra')).accessToken;

    await api('patch', `/api/equipe/funcionarios/${usuarioId}`)
      .send({
        nome: 'Responsável',
        papel: 'admin',
        ativo: true,
        permissoes: PERMISSOES,
        comissaoVendaPercentual: '10',
        comissaoExecucaoPercentual: '5',
      })
      .expect(200);

    clienteId = (await api('post', '/api/clientes').send({ nome: 'Cliente Obra' }).expect(201)).body.id;
    servicoId = (
      await api('post', '/api/servicos')
        .send({ nome: `Instalação ${marca}`, custoBase: '0,00', precoPadrao: '200,00' })
        .expect(201)
    ).body.id;
  });

  afterAll(async () => {
    for (const tenantId of tenantsCriados) {
      await prisma.comTenantExplicito(tenantId, (tx) => tx.tenant.deleteMany({ where: { id: tenantId } }));
    }
    await app.close();
  });

  describe('estoque', () => {
    it('cadastra o material e pondera o custo médio a cada entrada', async () => {
      materialId = (
        await api('post', '/api/estoque/materiais')
          .send({ nome: `Cabo ${marca}`, unidade: 'm', estoqueMinimo: '5' })
          .expect(201)
      ).body.id;

      await api('post', `/api/estoque/materiais/${materialId}/entradas`)
        .send({ quantidade: '10', custoUnitario: '2,00' })
        .expect(201);
      const { body } = await api('post', `/api/estoque/materiais/${materialId}/entradas`)
        .send({ quantidade: '10', custoUnitario: '4,00' })
        .expect(201);

      expect(body.quantidade).toBe('20');
      expect(body.custoMedio).toBe('3.0000');
      expect(body.valorEmEstoque).toBe('60.00');
    });

    it('outra empresa não enxerga o material', async () => {
      await api('get', `/api/estoque/materiais/${materialId}`, tokenOutra).expect(404);
    });

    it('salva a lista padrão de materiais do serviço com o custo estimado', async () => {
      const { body } = await api('put', `/api/servicos/${servicoId}/materiais`)
        .send({ itens: [{ materialId, quantidade: '3' }] })
        .expect(200);

      expect(body.itens).toHaveLength(1);
      expect(body.custoEstimado).toBe('9.00');
    });
  });

  describe('venda, execução e comissões', () => {
    it('aprovar o orçamento gera a comissão do vendedor', async () => {
      orcamentoId = (
        await api('post', '/api/orcamentos')
          .send({ clienteId, servicoId, valor: '1.000,00' })
          .expect(201)
      ).body.id;

      const { body } = await api('post', `/api/orcamentos/${orcamentoId}/status`)
        .send({ acao: 'aprovar' })
        .expect(201);
      expect(body.vendedorId).toBe(usuarioId);

      const relatorio = (await api('get', `/api/comissoes?${PERIODO}`).expect(200)).body;
      expect(relatorio.itens).toHaveLength(1);
      expect(relatorio.itens[0].tipo).toBe('venda');
      expect(relatorio.itens[0].valor).toBe('100.00');
    });

    it('recusa ligar o agendamento a orçamento de outro cliente', async () => {
      const outroCliente = (await api('post', '/api/clientes').send({ nome: 'Outro' }).expect(201)).body.id;

      await api('post', '/api/agendamentos')
        .send({ clienteId: outroCliente, servicoId, dataHora: '2026-09-10T10:00', orcamentoId })
        .expect(400);
    });

    it('executar baixa os materiais conferidos e gera a comissão do técnico', async () => {
      const agendamento = (
        await api('post', '/api/agendamentos')
          .send({ clienteId, servicoId, dataHora: '2026-09-10T10:00', tecnicoId: usuarioId, orcamentoId })
          .expect(201)
      ).body;

      await api('post', `/api/agendamentos/${agendamento.id}/status`)
        .send({ acao: 'executar', materiais: [{ materialId, quantidade: '4' }] })
        .expect(201);

      const atual = await material();
      expect(atual.quantidade).toBe('16');
      expect(atual.movimentacoes[0].tipo).toBe('consumo');
      expect(atual.movimentacoes[0].valorTotal).toBe('12.00');

      const relatorio = (await api('get', `/api/comissoes?${PERIODO}`).expect(200)).body;
      const execucao = relatorio.itens.find((item: { tipo: string }) => item.tipo === 'execucao');
      expect(execucao.valor).toBe('50.00');
      expect(relatorio.totalPendente).toBe('150.00');
    });

    it('sem conferência, a execução usa a lista padrão do serviço', async () => {
      const agendamento = (
        await api('post', '/api/agendamentos')
          .send({ clienteId, servicoId, dataHora: '2026-09-11T10:00' })
          .expect(201)
      ).body;

      await api('post', `/api/agendamentos/${agendamento.id}/status`)
        .send({ acao: 'executar' })
        .expect(201);

      expect((await material()).quantidade).toBe('13');
    });

    it('a margem do serviço inclui materiais e comissões', async () => {
      const { body } = await api('get', `/api/financeiro/margem?${PERIODO}`).expect(200);
      const item = body.itens.find((linha: { servicoId: string }) => linha.servicoId === servicoId);

      expect(item.custoMateriais).toBe('21.00');
      expect(item.custoComissoes).toBe('150.00');
      expect(item.custo).toBe('171.00');
    });

    it('fechar gera a conta a pagar e não fecha duas vezes', async () => {
      const { body } = await api('post', '/api/comissoes/fechar')
        .send({ usuarioId, de: '2000-01-01', ate: '2100-12-31' })
        .expect(200);

      expect(body.valor).toBe('150.00');
      expect(body.quantidade).toBe(2);

      const relatorio = (await api('get', `/api/comissoes?${PERIODO}`).expect(200)).body;
      expect(relatorio.totalPendente).toBe('0.00');
      expect(relatorio.totalFechado).toBe('150.00');

      await api('post', '/api/comissoes/fechar')
        .send({ usuarioId, de: '2000-01-01', ate: '2100-12-31' })
        .expect(400);
    });

    it('minhas comissões mostra só as de quem está logado', async () => {
      const minhas = (await api('get', `/api/comissoes/minhas?${PERIODO}`).expect(200)).body;
      expect(minhas.itens).toHaveLength(2);
      expect(minhas.totalFechado).toBe('150.00');

      const daOutra = (await api('get', `/api/comissoes/minhas?${PERIODO}`, tokenOutra).expect(200))
        .body;
      expect(daOutra.itens).toHaveLength(0);

      // A pessoa vem do token: pedir outra pela URL nunca devolve as comissões dela.
      const tentativa = await api(
        'get',
        `/api/comissoes/minhas?${PERIODO}&usuarioId=${usuarioId}`,
        tokenOutra,
      );
      expect(tentativa.status === 400 || tentativa.body.itens.length === 0).toBe(true);
    });
  });

  describe('ajuste de contagem', () => {
    it('ajusta o saldo para o que foi contado e recusa contagem igual', async () => {
      const { body } = await api('post', `/api/estoque/materiais/${materialId}/ajustes`)
        .send({ quantidadeContada: '10', observacao: 'Inventário mensal' })
        .expect(201);

      expect(body.quantidade).toBe('10');

      await api('post', `/api/estoque/materiais/${materialId}/ajustes`)
        .send({ quantidadeContada: '10', observacao: 'De novo' })
        .expect(400);
    });
  });
});
