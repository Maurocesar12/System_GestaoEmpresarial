import { Test, type TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../../../app.module';
import { PrismaService } from '../../../infra/prisma/prisma.service';

/**
 * Serviços e orçamentos, ponta a ponta.
 *
 * O foco está na máquina de estados e no tratamento do dinheiro — os dois
 * pontos onde um erro não aparece na tela, mas aparece no caixa no fim do mês.
 */
describe('serviços e orçamentos (HTTP)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const marca = randomUUID().slice(0, 8);
  const tenantsCriados: string[] = [];

  let tokenA: string;
  let tokenB: string;
  let clienteId: string;
  let servicoId: string;

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

  async function criarEmpresa(sufixo: string): Promise<string> {
    const { body } = await request(app.getHttpServer())
      .post('/api/onboarding/cadastro')
      .send({
        nomeEmpresa: `Orc ${sufixo} ${marca}`,
        nomeResponsavel: 'Responsável',
        email: `orc-${sufixo}+${marca}@exemplo.com`,
        senha: 'senhaSegura123',
      })
      .expect(201);

    tenantsCriados.push(body.usuario.tenantId);
    return body.accessToken;
  }

  /** Cria um orçamento aberto e devolve o id. */
  async function novoOrcamento(valor = '1500,00'): Promise<string> {
    const { body } = await comToken(tokenA)
      .post('/api/orcamentos')
      .send({ clienteId, servicoId, valor })
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

    const { body: cliente } = await comToken(tokenA)
      .post('/api/clientes')
      .send({ nome: `Cliente Orc ${marca}` })
      .expect(201);
    clienteId = cliente.id;

    const { body: servico } = await comToken(tokenA)
      .post('/api/servicos')
      .send({ nome: `Instalação ${marca}`, custoBase: '250,00', precoPadrao: '600,00' })
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

  describe('catálogo de serviços', () => {
    it('converte o valor digitado em pt-BR para decimal', async () => {
      // Quem cadastra digita "1.250,50"; o banco precisa de "1250.50".
      const { body } = await comToken(tokenA)
        .post('/api/servicos')
        .send({ nome: `Reforma ${marca}`, custoBase: '1.250,50', precoPadrao: '3.000,00' })
        .expect(201);

      expect(body.custoBase).toBe('1250.50');
      expect(body.precoPadrao).toBe('3000.00');
    });

    it('aceita custo zero, mas não custo em branco', async () => {
      // Zero é resposta legítima; em branco inviabiliza o cálculo de margem.
      await comToken(tokenA)
        .post('/api/servicos')
        .send({ nome: `Consulta ${marca}`, custoBase: '0,00' })
        .expect(201);

      await comToken(tokenA)
        .post('/api/servicos')
        .send({ nome: `Sem custo ${marca}`, custoBase: '' })
        .expect(400);
    });

    it('recusa nome repetido na mesma empresa', async () => {
      await comToken(tokenA)
        .post('/api/servicos')
        .send({ nome: `Instalação ${marca}`, custoBase: '100,00' })
        .expect(409);
    });

    it('desativa em vez de apagar, preservando o histórico', async () => {
      const { body: servico } = await comToken(tokenA)
        .post('/api/servicos')
        .send({ nome: `Temporário ${marca}`, custoBase: '10,00' })
        .expect(201);

      const { body: desativado } = await comToken(tokenA)
        .delete(`/api/servicos/${servico.id}`)
        .expect(200);

      expect(desativado.ativo).toBe(false);

      // Continua acessível: orçamentos antigos apontam para ele.
      await comToken(tokenA).get(`/api/servicos/${servico.id}`).expect(200);
    });
  });

  describe('emissão de orçamento', () => {
    it('cria com os dados do cliente e do serviço', async () => {
      const { body } = await comToken(tokenA)
        .post('/api/orcamentos')
        .send({ clienteId, servicoId, valor: '2.400,00', descricao: 'Troca completa' })
        .expect(201);

      expect(body.valor).toBe('2400.00');
      expect(body.status).toBe('aberto');
      expect(body.clienteNome).toContain('Cliente Orc');
      expect(body.servicoNome).toContain('Instalação');
    });

    it('recusa cliente inexistente com mensagem clara', async () => {
      const resposta = await comToken(tokenA)
        .post('/api/orcamentos')
        .send({ clienteId: randomUUID(), valor: '100,00' })
        .expect(404);

      expect(resposta.body.mensagem).toMatch(/cliente/i);
    });

    it('permite orçamento sem serviço do catálogo', async () => {
      // Nem todo trabalho se encaixa numa linha do catálogo.
      await comToken(tokenA)
        .post('/api/orcamentos')
        .send({ clienteId, servicoId: '', valor: '300,00' })
        .expect(201);
    });
  });

  describe('máquina de estados', () => {
    it('aprova um orçamento aberto e registra a resposta', async () => {
      const id = await novoOrcamento();

      const { body } = await comToken(tokenA)
        .post(`/api/orcamentos/${id}/status`)
        .send({ acao: 'aprovar' })
        .expect(201);

      expect(body.status).toBe('aprovado');
      expect(body.respondidoEm).not.toBeNull();
    });

    it('recusa e depois reabre para renegociação', async () => {
      const id = await novoOrcamento();

      await comToken(tokenA)
        .post(`/api/orcamentos/${id}/status`)
        .send({ acao: 'recusar' })
        .expect(201);

      const { body } = await comToken(tokenA)
        .post(`/api/orcamentos/${id}/status`)
        .send({ acao: 'reabrir' })
        .expect(201);

      expect(body.status).toBe('aberto');
      // Reabrir limpa a marca: a resposta anterior deixou de valer.
      expect(body.respondidoEm).toBeNull();
    });

    it('não desfaz uma aprovação', async () => {
      // Aprovado é final: o valor virou compromisso e vai virar receita.
      const id = await novoOrcamento();

      await comToken(tokenA)
        .post(`/api/orcamentos/${id}/status`)
        .send({ acao: 'aprovar' })
        .expect(201);

      const resposta = await comToken(tokenA)
        .post(`/api/orcamentos/${id}/status`)
        .send({ acao: 'reabrir' })
        .expect(400);

      expect(resposta.body.mensagem).toMatch(/não aceita mais/i);
    });

    it('explica quais ações são possíveis quando a transição é inválida', async () => {
      const id = await novoOrcamento();

      await comToken(tokenA)
        .post(`/api/orcamentos/${id}/status`)
        .send({ acao: 'recusar' })
        .expect(201);

      const resposta = await comToken(tokenA)
        .post(`/api/orcamentos/${id}/status`)
        .send({ acao: 'aprovar' })
        .expect(400);

      // A mensagem diz o caminho, em vez de só negar.
      expect(resposta.body.mensagem).toMatch(/reabrir/i);
    });

    it('não altera orçamento já aprovado', async () => {
      const id = await novoOrcamento();

      await comToken(tokenA)
        .post(`/api/orcamentos/${id}/status`)
        .send({ acao: 'aprovar' })
        .expect(201);

      await comToken(tokenA)
        .patch(`/api/orcamentos/${id}`)
        .send({ clienteId, valor: '9.999,00' })
        .expect(400);
    });

    it('não exclui orçamento aprovado', async () => {
      const id = await novoOrcamento();

      await comToken(tokenA)
        .post(`/api/orcamentos/${id}/status`)
        .send({ acao: 'aprovar' })
        .expect(201);

      await comToken(tokenA).delete(`/api/orcamentos/${id}`).expect(400);
    });
  });

  describe('resumo por status', () => {
    it('soma os valores no banco, sem perder centavos', async () => {
      // A soma acontece em NUMERIC no Postgres. Somar em JavaScript traria os
      // registros para a memória e faria a conta em ponto flutuante.
      const { body: resumo } = await comToken(tokenA).get('/api/orcamentos/resumo').expect(200);

      expect(resumo.aprovados.quantidade).toBeGreaterThan(0);
      // Formato decimal com duas casas, nunca notação científica ou float.
      expect(resumo.aprovados.valor).toMatch(/^\d+\.\d{2}$/);
      expect(resumo.abertos.valor).toMatch(/^\d+\.\d{2}$/);
    });
  });

  describe('isolamento entre empresas', () => {
    it('não lista orçamentos de outra empresa', async () => {
      const { body } = await comToken(tokenB).get('/api/orcamentos').expect(200);

      expect(body.meta.total).toBe(0);
    });

    it('não encontra orçamento de outra empresa pelo id', async () => {
      const id = await novoOrcamento();

      await comToken(tokenB).get(`/api/orcamentos/${id}`).expect(404);
    });

    it('não usa serviço de outra empresa em um orçamento', async () => {
      const { body: clienteB } = await comToken(tokenB)
        .post('/api/clientes')
        .send({ nome: 'Cliente da B' })
        .expect(201);

      await comToken(tokenB)
        .post('/api/orcamentos')
        .send({ clienteId: clienteB.id, servicoId, valor: '100,00' })
        .expect(404);
    });

    it('o resumo de uma empresa não soma valores da outra', async () => {
      const { body: resumo } = await comToken(tokenB).get('/api/orcamentos/resumo').expect(200);

      expect(resumo.abertos.valor).toBe('0.00');
      expect(resumo.aprovados.valor).toBe('0.00');
    });
  });
});
