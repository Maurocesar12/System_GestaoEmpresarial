import { Test, type TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../infra/prisma/prisma.service';

/**
 * Fluxo de autenticação, ponta a ponta.
 *
 * Sobe a aplicação inteira e conversa com ela por HTTP, como o frontend faria.
 * Testar os services isoladamente não provaria que os guards, o middleware de
 * tenant e as rotas estão corretamente ligados — e foi exatamente esse tipo de
 * desencontro que derrubou a API na fatia anterior.
 *
 * Rode com: pnpm --filter @gestao/api test:db
 */
describe('autenticação (HTTP)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  /** Sufixo único por execução, para não colidir com dados de outras rodadas. */
  const marca = randomUUID().slice(0, 8);
  const email = `teste+${marca}@exemplo.com`;
  const senha = 'senhaSegura123';
  const tenantsCriados: string[] = [];

  beforeAll(async () => {
    // O banco de teste e os limites de rate limit são definidos em
    // `test/setup-integration.ts`, antes de qualquer módulo ser importado.
    const modulo: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = modulo.createNestApplication();
    app.setGlobalPrefix('api', { exclude: ['health'] });
    await app.init();

    prisma = modulo.get(PrismaService);

    // O cadastro precisa do plano padrão para existir. O banco de teste é
    // recriado do zero e não recebe o seed, então a suíte cria o que precisa —
    // depender de um passo manual anterior a tornaria frágil.
    const slug = process.env.ONBOARDING_PLANO_PADRAO ?? 'essencial';
    await prisma.plano.upsert({
      where: { slug },
      create: { nome: 'Plano de teste', slug, preco: '0.00' },
      update: {},
    });
  });

  afterAll(async () => {
    // Cada empresa é apagada dentro do próprio contexto — sem ele a RLS não
    // enxerga a linha e o delete não afeta nada.
    for (const tenantId of tenantsCriados) {
      await prisma.comTenantExplicito(tenantId, (tx) =>
        tx.tenant.deleteMany({ where: { id: tenantId } }),
      );
    }
    await app.close();
  });

  const cadastrar = (dados?: Partial<Record<string, string>>) =>
    request(app.getHttpServer())
      .post('/api/onboarding/cadastro')
      .send({
        nomeEmpresa: `Empresa ${marca}`,
        nomeResponsavel: 'Responsável de Teste',
        email,
        senha,
        ...dados,
      });

  describe('cadastro', () => {
    it('cria empresa, usuário admin e devolve a sessão pronta', async () => {
      const resposta = await cadastrar().expect(201);

      tenantsCriados.push(resposta.body.usuario.tenantId);

      expect(resposta.body.usuario.email).toBe(email);
      // O primeiro usuário precisa ser admin: é ele quem vai convidar a equipe.
      expect(resposta.body.usuario.papel).toBe('admin');
      expect(resposta.body.accessToken).toEqual(expect.any(String));
      expect(resposta.body.refreshToken).toEqual(expect.any(String));
    });

    it('cria as sete etapas do funil para a empresa nova', async () => {
      const tenantId = tenantsCriados[0];

      const etapas = await prisma.comTenantExplicito(tenantId!, (tx) =>
        tx.etapaFunil.findMany({ orderBy: { ordem: 'asc' } }),
      );

      expect(etapas).toHaveLength(7);
      expect(etapas[0]?.nome).toBe('Novo contato');
      expect(etapas[6]?.nome).toBe('Pós-venda');
    });

    it('recusa e-mail já cadastrado', async () => {
      // Sem isso, duas empresas teriam o mesmo e-mail e o login não teria como
      // saber em qual autenticar.
      const resposta = await cadastrar().expect(409);

      expect(resposta.body.codigo).toBe('CONFLITO');
    });

    it('recusa senha curta demais', async () => {
      const resposta = await cadastrar({
        email: `outro+${marca}@exemplo.com`,
        senha: 'curta',
      }).expect(400);

      expect(resposta.body.detalhes).toHaveProperty('senha');
    });
  });

  describe('login', () => {
    it('autentica com as credenciais corretas', async () => {
      const resposta = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email, senha })
        .expect(200);

      expect(resposta.body.usuario.email).toBe(email);
      expect(resposta.body.usuario.nomeEmpresa).toBe(`Empresa ${marca}`);
    });

    it('normaliza o e-mail antes de procurar', async () => {
      // Quem digita "  Teste@Exemplo.COM " deve entrar do mesmo jeito.
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: `  ${email.toUpperCase()} `, senha })
        .expect(200);
    });

    it('recusa senha errada', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email, senha: 'senhaCompletamenteErrada' })
        .expect(401);
    });

    it('responde a e-mail inexistente igual a senha errada', async () => {
      // Mensagens diferentes revelariam quais e-mails têm conta no sistema.
      const inexistente = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: `nao-existe+${marca}@exemplo.com`, senha })
        .expect(401);

      const senhaErrada = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email, senha: 'senhaCompletamenteErrada' })
        .expect(401);

      expect(inexistente.body.mensagem).toBe(senhaErrada.body.mensagem);
    });
  });

  describe('rotas protegidas', () => {
    it('recusa requisição sem token', async () => {
      // O guard é global: rota nova nasce protegida, sem precisar lembrar disso.
      await request(app.getHttpServer()).get('/api/auth/eu').expect(401);
    });

    it('recusa token adulterado', async () => {
      const { body } = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email, senha });

      // Troca o último caractere: a assinatura deixa de bater.
      const adulterado =
        body.accessToken.slice(0, -1) + (body.accessToken.endsWith('a') ? 'b' : 'a');

      await request(app.getHttpServer())
        .get('/api/auth/eu')
        .set('Authorization', `Bearer ${adulterado}`)
        .expect(401);
    });

    it('devolve o usuário do token', async () => {
      const { body } = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email, senha });

      const resposta = await request(app.getHttpServer())
        .get('/api/auth/eu')
        .set('Authorization', `Bearer ${body.accessToken}`)
        .expect(200);

      expect(resposta.body.email).toBe(email);
      expect(resposta.body).not.toHaveProperty('senhaHash');
    });

    it('não expõe o hash da senha em nenhuma resposta', async () => {
      const resposta = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email, senha });

      expect(JSON.stringify(resposta.body)).not.toContain('$argon2');
    });
  });

  describe('rotação de refresh token', () => {
    it('troca o token por um novo', async () => {
      const { body: sessao } = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email, senha });

      const resposta = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken: sessao.refreshToken })
        .expect(200);

      expect(resposta.body.refreshToken).not.toBe(sessao.refreshToken);
      expect(resposta.body.accessToken).toEqual(expect.any(String));
    });

    it('derruba todas as sessões quando um token é reutilizado', async () => {
      const { body: sessao } = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email, senha });

      const { body: renovada } = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken: sessao.refreshToken })
        .expect(200);

      // Apresentar o token antigo de novo só acontece se ele foi copiado.
      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken: sessao.refreshToken })
        .expect(401);

      // E o token legítimo emitido no lugar também cai: não há como saber qual
      // das duas partes é a legítima, então as duas perdem a sessão.
      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken: renovada.refreshToken })
        .expect(401);
    });

    it('recusa refresh token de formato inválido', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken: 'isto-nao-e-um-token' })
        .expect(401);
    });
  });

  describe('logout', () => {
    it('encerra a sessão e invalida o refresh token', async () => {
      const { body: sessao } = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email, senha });

      await request(app.getHttpServer())
        .post('/api/auth/logout')
        .send({ refreshToken: sessao.refreshToken })
        .expect(204);

      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken: sessao.refreshToken })
        .expect(401);
    });
  });
});
