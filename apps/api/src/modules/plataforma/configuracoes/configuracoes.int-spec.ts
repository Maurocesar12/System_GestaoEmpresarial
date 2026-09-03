import { Test, type TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../../../app.module';
import { PrismaService } from '../../../infra/prisma/prisma.service';

describe('configurações, campos e etiquetas (HTTP)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const marca = randomUUID().slice(0, 8);
  const tenantsCriados: string[] = [];
  let tokenA: string;
  let tokenB: string;
  let campoId: string;
  let etiquetaId: string;
  let clienteId: string;

  const autenticado = (token: string) => ({
    get: (rota: string) =>
      request(app.getHttpServer()).get(rota).set('Authorization', `Bearer ${token}`),
    post: (rota: string) =>
      request(app.getHttpServer()).post(rota).set('Authorization', `Bearer ${token}`),
    put: (rota: string) =>
      request(app.getHttpServer()).put(rota).set('Authorization', `Bearer ${token}`),
    patch: (rota: string) =>
      request(app.getHttpServer()).patch(rota).set('Authorization', `Bearer ${token}`),
  });

  async function criarEmpresa(sufixo: string): Promise<string> {
    const { body } = await request(app.getHttpServer())
      .post('/api/onboarding/cadastro')
      .send({
        nomeEmpresa: `Configuração ${sufixo} ${marca}`,
        nomeResponsavel: 'Administrador',
        email: `config-${sufixo}+${marca}@exemplo.com`,
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

  it('salva os dados da empresa e cria definições reutilizáveis', async () => {
    const { body } = await autenticado(tokenA)
      .put('/api/configuracoes')
      .send({
        nome: `Empresa organizada ${marca}`,
        cnpj: '12.345.678/0001-99',
        email: 'contato@empresa.com',
        telefone: '(11) 91234-5678',
        campos: [
          {
            nome: 'Segmento',
            tipo: 'selecao',
            obrigatorio: true,
            opcoes: ['Premium', 'Básico'],
          },
        ],
        etiquetas: [{ nome: 'Prioridade', cor: '#D8B4A0' }],
      })
      .expect(200);

    expect(body).toMatchObject({
      nome: `Empresa organizada ${marca}`,
      cnpj: '12345678000199',
      telefone: '11912345678',
    });
    campoId = body.campos[0].id;
    etiquetaId = body.etiquetas[0].id;
  });

  it('informa quando o teste de e-mail está no modo simulado', async () => {
    const { body } = await autenticado(tokenA)
      .post('/api/configuracoes/email/testar')
      .send({ email: `receber-teste+${marca}@exemplo.com` })
      .expect(201);

    expect(body.modo).toBe('simulado');
  });

  it('valida campo obrigatório ao cadastrar um cliente', async () => {
    const resposta = await autenticado(tokenA)
      .post('/api/clientes')
      .send({ nome: 'Sem segmento', camposPersonalizados: {}, etiquetas: [] })
      .expect(400);

    expect(resposta.body.mensagem).toContain('Segmento');
  });

  it('grava e devolve campo personalizado e etiqueta sem resposta desatualizada', async () => {
    const { body } = await autenticado(tokenA)
      .post('/api/clientes')
      .send({
        nome: 'Cliente Premium',
        camposPersonalizados: { [campoId]: 'Premium' },
        etiquetas: [etiquetaId],
      })
      .expect(201);

    clienteId = body.id;
    expect(body.camposPersonalizados).toEqual({ [campoId]: 'Premium' });
    expect(body.etiquetas).toEqual([etiquetaId]);

    const { body: alterado } = await autenticado(tokenA)
      .patch(`/api/clientes/${clienteId}`)
      .send({
        nome: 'Cliente Premium',
        camposPersonalizados: { [campoId]: 'Básico' },
        etiquetas: [],
      })
      .expect(200);

    expect(alterado.camposPersonalizados).toEqual({ [campoId]: 'Básico' });
    expect(alterado.etiquetas).toEqual([]);
  });

  it('não expõe campos e etiquetas para outra empresa', async () => {
    const { body } = await autenticado(tokenB).get('/api/configuracoes').expect(200);

    expect(body.campos).toEqual([]);
    expect(body.etiquetas).toEqual([]);
  });

  it('recusa reutilizar o id de um campo de outra empresa', async () => {
    const resposta = await autenticado(tokenB)
      .put('/api/configuracoes')
      .send({
        nome: `Configuração b ${marca}`,
        cnpj: null,
        email: null,
        telefone: null,
        campos: [
          {
            id: campoId,
            nome: 'Campo indevido',
            tipo: 'texto',
            obrigatorio: false,
            opcoes: [],
          },
        ],
        etiquetas: [],
      })
      .expect(400);

    expect(resposta.body.codigo).toBe('VALIDACAO');
  });

  it('explica quando campos têm nomes repetidos', async () => {
    const resposta = await autenticado(tokenB)
      .put('/api/configuracoes')
      .send({
        nome: `Configuração b ${marca}`,
        cnpj: null,
        email: null,
        telefone: null,
        campos: [
          { nome: 'Região', tipo: 'texto', obrigatorio: false, opcoes: [] },
          { nome: 'região', tipo: 'texto', obrigatorio: false, opcoes: [] },
        ],
        etiquetas: [],
      })
      .expect(400);

    expect(Object.keys(resposta.body.detalhes)).toContain('campos.1.nome');
  });
});
