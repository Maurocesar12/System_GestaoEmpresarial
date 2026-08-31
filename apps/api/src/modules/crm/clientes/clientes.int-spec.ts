import { Test, type TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { CODIGOS_ERRO } from '@gestao/shared-types';
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
  const planosCriados: string[] = [];

  /** Sessões de duas empresas diferentes, para os testes de isolamento. */
  let tokenA: string;
  let tokenB: string;

  async function cadastrarEmpresa(
    sufixo: string,
  ): Promise<{ accessToken: string; tenantId: string }> {
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
    return { accessToken: body.accessToken, tenantId: body.usuario.tenantId };
  }

  async function criarEmpresa(sufixo: string): Promise<string> {
    const empresa = await cadastrarEmpresa(sufixo);
    return empresa.accessToken;
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

    await prisma.plano.deleteMany({ where: { slug: { in: planosCriados } } });
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

    it('recusa novo cliente quando o plano atingiu o limite', async () => {
      const { accessToken, tenantId } = await cadastrarEmpresa('empresa-limite-clientes');
      const slug = `limite-clientes-${marca}`;
      planosCriados.push(slug);

      const plano = await prisma.plano.upsert({
        where: { slug },
        create: {
          nome: 'Plano com limite zero',
          slug,
          preco: '0.00',
          limiteClientes: 0,
        },
        update: { limiteClientes: 0 },
      });

      await prisma.comTenantExplicito(tenantId, (tx) =>
        tx.tenant.update({ where: { id: tenantId }, data: { planoId: plano.id } }),
      );

      const resposta = await comToken(accessToken)
        .post('/api/clientes')
        .send({ nome: 'Cliente Bloqueado' })
        .expect(403);

      expect(resposta.body.codigo).toBe(CODIGOS_ERRO.LIMITE_PLANO_EXCEDIDO);
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

  describe('importação em massa', () => {
    /**
     * Empresa própria para este bloco: a importação cria dezenas de clientes e
     * mexeria nas contagens dos testes de listagem se dividisse a empresa.
     */
    let token: string;
    let tenantId: string;

    beforeAll(async () => {
      const empresa = await cadastrarEmpresa('importacao');
      token = empresa.accessToken;
      tenantId = empresa.tenantId;
    });

    const importar = (clientes: Record<string, unknown>[]) =>
      comToken(token).post('/api/clientes/importar').send({ clientes });

    it('cria o lote inteiro numa única requisição', async () => {
      const { body } = await importar([
        { nome: 'Lote Um', telefone: '11911111111' },
        { nome: 'Lote Dois', telefone: '11922222222' },
        { nome: 'Lote Três', email: 'lote3@exemplo.com' },
      ]).expect(201);

      expect(body.criados).toBe(3);
      expect(body.ignorados).toEqual([]);
    });

    it('coloca os importados na primeira etapa do funil', async () => {
      // O cadastro individual faz isso; a importação não pode deixar clientes
      // fora do funil, senão eles somem do quadro de vendas.
      await importar([{ nome: `Funil ${marca}` }]).expect(201);

      const { body } = await comToken(token).get('/api/funil').expect(200);
      const nomes = body.colunas.flatMap((coluna: { clientes: { nome: string }[] }) =>
        coluna.clientes.map((cliente) => cliente.nome),
      );

      expect(nomes).toContain(`Funil ${marca}`);
    });

    it('normaliza telefone e documento como no cadastro individual', async () => {
      await importar([
        { nome: 'Com Máscara', telefone: '(11) 93333-3333', documento: '123.456.789-09' },
      ]).expect(201);

      const { body } = await comToken(token)
        .get('/api/clientes?busca=Com%20M%C3%A1scara')
        .expect(200);

      expect(body.dados[0].telefone).toBe('11933333333');
      expect(body.dados[0].documento).toBe('12345678909');
    });

    it('pula quem já existe no banco, dizendo o motivo', async () => {
      await importar([{ nome: 'Já Existe', documento: '11122233344' }]).expect(201);

      const { body } = await importar([
        { nome: 'Já Existe de novo', documento: '11122233344' },
        { nome: 'Esse é novo', documento: '55566677788' },
      ]).expect(201);

      expect(body.criados).toBe(1);
      expect(body.ignorados).toEqual([
        { indice: 0, nome: 'Já Existe de novo', motivo: 'documento_repetido' },
      ]);
    });

    it('pula repetidos dentro da própria planilha', async () => {
      const { body } = await importar([
        { nome: 'Primeiro', email: 'repetido@exemplo.com' },
        { nome: 'Segundo', email: 'repetido@exemplo.com' },
      ]).expect(201);

      expect(body.criados).toBe(1);
      expect(body.ignorados[0]).toMatchObject({ indice: 1, motivo: 'repetido_no_arquivo' });
    });

    it('não trata homônimos sem documento como repetidos', async () => {
      // Dois "João Silva" sem CPF são duas pessoas até prova em contrário.
      const { body } = await importar([{ nome: 'João Silva' }, { nome: 'João Silva' }]).expect(201);

      expect(body.criados).toBe(2);
    });

    it('recusa a planilha inteira quando ela não cabe no plano', async () => {
      // Falha total, e não parcial: importar 300 de 500 e avisar depois deixaria
      // o usuário sem saber quais entraram.
      const empresa = await cadastrarEmpresa('importacao-limite');
      const slug = `limite-importacao-${marca}`;
      planosCriados.push(slug);

      const plano = await prisma.plano.upsert({
        where: { slug },
        create: { nome: 'Plano com duas vagas', slug, preco: '0.00', limiteClientes: 2 },
        update: { limiteClientes: 2 },
      });

      await prisma.comTenantExplicito(empresa.tenantId, (tx) =>
        tx.tenant.update({ where: { id: empresa.tenantId }, data: { planoId: plano.id } }),
      );

      const resposta = await comToken(empresa.accessToken)
        .post('/api/clientes/importar')
        .send({ clientes: [{ nome: 'Um' }, { nome: 'Dois' }, { nome: 'Três' }] })
        .expect(403);

      expect(resposta.body.codigo).toBe(CODIGOS_ERRO.LIMITE_PLANO_EXCEDIDO);
      expect(resposta.body.mensagem).toMatch(/cabem/i);

      // Nada gravado: a transação inteira foi desfeita.
      const { body } = await comToken(empresa.accessToken)
        .get('/api/clientes?porPagina=1')
        .expect(200);

      expect(body.meta.total).toBe(0);
    });

    it('recusa lote acima do teto por requisição', async () => {
      const enorme = Array.from({ length: 501 }, (_, i) => ({ nome: `Teto ${i}` }));

      await importar(enorme).expect(400);
    });

    it('recusa lote vazio', async () => {
      await importar([]).expect(400);
    });

    it('recusa linha inválida sem gravar as válidas', async () => {
      // Validação é do lote: uma linha ruim é erro de planilha, e o usuário
      // precisa corrigir antes — não descobrir depois que faltou gente.
      await importar([{ nome: 'Válido' }, { nome: 'x' }]).expect(400);
    });

    it('não deixa atendente importar', async () => {
      // Importar mil clientes de uma vez tem peso diferente de cadastrar um.
      await prisma.comTenantExplicito(tenantId, (tx) =>
        tx.usuario.updateMany({ where: { tenantId }, data: { papel: 'atendente' } }),
      );

      // Precisa entrar de novo: o papel vem do JWT, e o token emitido antes da
      // troca continua dizendo "admin" até expirar.
      const { body: sessao } = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: `importacao+${marca}@exemplo.com`, senha: 'senhaSegura123' })
        .expect(200);

      await request(app.getHttpServer())
        .post('/api/clientes/importar')
        .set('Authorization', `Bearer ${sessao.accessToken}`)
        .send({ clientes: [{ nome: 'Negado' }] })
        .expect(403);

      await prisma.comTenantExplicito(tenantId, (tx) =>
        tx.usuario.updateMany({ where: { tenantId }, data: { papel: 'admin' } }),
      );
    });
  });
});
