import { Test, type TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../../../app.module';
import { Notificador, type MensagemNotificacao } from '../../../infra/notificacoes/notificador';
import { PrismaService } from '../../../infra/prisma/prisma.service';

describe('equipe, permissões e auditoria (HTTP)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const marca = randomUUID().slice(0, 8);
  const senha = 'senhaSegura123';
  const emailFuncionario = `funcionario+${marca}@exemplo.com`;
  const tenantsCriados: string[] = [];
  const enviar = jest.fn<Promise<void>, [MensagemNotificacao]>().mockResolvedValue(undefined);

  let tokenAdminA: string;
  let tokenAdminB: string;
  let tenantA: string;
  let funcionarioId: string;

  const autenticado = (token: string) => ({
    get: (rota: string) =>
      request(app.getHttpServer()).get(rota).set('Authorization', `Bearer ${token}`),
    post: (rota: string) =>
      request(app.getHttpServer()).post(rota).set('Authorization', `Bearer ${token}`),
    patch: (rota: string) =>
      request(app.getHttpServer()).patch(rota).set('Authorization', `Bearer ${token}`),
  });

  async function criarEmpresa(sufixo: string): Promise<string> {
    const resposta = await request(app.getHttpServer())
      .post('/api/onboarding/cadastro')
      .send({
        nomeEmpresa: `Empresa equipe ${sufixo} ${marca}`,
        nomeResponsavel: `Admin ${sufixo}`,
        email: `admin-equipe-${sufixo}+${marca}@exemplo.com`,
        senha,
      })
      .expect(201);

    tenantsCriados.push(resposta.body.usuario.tenantId);
    return resposta.body.accessToken;
  }

  beforeAll(async () => {
    const modulo: TestingModule = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(Notificador)
      .useValue({ enviar })
      .compile();

    app = modulo.createNestApplication();
    app.setGlobalPrefix('api', { exclude: ['health'] });
    await app.init();
    prisma = modulo.get(PrismaService);

    const slug = process.env.ONBOARDING_PLANO_PADRAO ?? 'essencial';
    await prisma.plano.upsert({
      where: { slug },
      create: {
        nome: 'Plano de teste',
        slug,
        preco: '0.00',
        limiteUsuarios: 3,
      },
      update: { limiteUsuarios: 3 },
    });

    tokenAdminA = await criarEmpresa('a');
    tenantA = tenantsCriados[0]!;
    tokenAdminB = await criarEmpresa('b');
  });

  afterAll(async () => {
    for (const tenantId of tenantsCriados) {
      await prisma.comTenantExplicito(tenantId, (tx) =>
        tx.tenant.deleteMany({ where: { id: tenantId } }),
      );
    }
    await app.close();
  });

  it('convida, envia um link e registra a ação na auditoria', async () => {
    await autenticado(tokenAdminA)
      .post('/api/equipe/convites')
      .send({
        nome: 'Funcionário convidado',
        email: emailFuncionario,
        papel: 'atendente',
        permissoes: ['clientes.visualizar'],
      })
      .expect(204);

    expect(enviar).toHaveBeenCalledTimes(1);
    const mensagem = enviar.mock.calls[0]![0];
    expect(mensagem.destinatario).toBe(emailFuncionario);
    expect(mensagem.corpo).toContain('/aceitar-convite?token=');

    const { body: auditoria } = await autenticado(tokenAdminA).get('/api/auditoria').expect(200);
    expect(auditoria).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ entidade: 'funcionario', acao: 'convidou' }),
      ]),
    );
  });

  it('não aceita um token de convite como sessão autenticada', async () => {
    const tokenConvite = extrairTokenDoConvite(enviar.mock.calls[0]![0]);

    await autenticado(tokenConvite).get('/api/configuracoes').expect(401);
  });

  it('aceita o convite e cria uma conta com apenas as ações concedidas', async () => {
    const tokenConvite = extrairTokenDoConvite(enviar.mock.calls[0]![0]);
    const { body: sessao } = await request(app.getHttpServer())
      .post('/api/equipe/convites/aceitar')
      .send({ token: tokenConvite, nome: 'Maria da Equipe', senha })
      .expect(201);

    expect(sessao.usuario.permissoes).toEqual(['clientes.visualizar']);
    expect(sessao.usuario.tenantId).toBe(tenantA);
    funcionarioId = sessao.usuario.id;

    await autenticado(sessao.accessToken).get('/api/clientes').expect(200);
    await autenticado(sessao.accessToken)
      .post('/api/clientes')
      .send({ nome: 'Cliente sem permissão', camposPersonalizados: {}, etiquetas: [] })
      .expect(403);
    await autenticado(sessao.accessToken).get('/api/equipe').expect(403);
  });

  it('impede convidar um e-mail que já pertence a outra empresa', async () => {
    const resposta = await autenticado(tokenAdminB)
      .post('/api/equipe/convites')
      .send({ nome: 'Duplicado', email: emailFuncionario, papel: 'tecnico' })
      .expect(409);

    expect(resposta.body.codigo).toBe('CONFLITO');
  });

  it('isola a equipe entre empresas', async () => {
    const { body } = await autenticado(tokenAdminB).get('/api/equipe').expect(200);

    expect(body.funcionarios).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ email: emailFuncionario })]),
    );
  });

  it('reserva vagas para convites pendentes e respeita o limite do plano', async () => {
    await autenticado(tokenAdminA)
      .post('/api/equipe/convites')
      .send({
        nome: 'Última vaga',
        email: `ultima-vaga+${marca}@exemplo.com`,
        papel: 'tecnico',
      })
      .expect(204);

    const resposta = await autenticado(tokenAdminA)
      .post('/api/equipe/convites')
      .send({
        nome: 'Acima do plano',
        email: `sem-vaga+${marca}@exemplo.com`,
        papel: 'atendente',
      })
      .expect(403);

    expect(resposta.body.codigo).toBe('LIMITE_PLANO_EXCEDIDO');
  });

  it('aplica uma nova permissão por ação após o próximo login', async () => {
    await autenticado(tokenAdminA)
      .patch(`/api/equipe/funcionarios/${funcionarioId}`)
      .send({
        nome: 'Maria da Equipe',
        papel: 'atendente',
        ativo: true,
        permissoes: ['clientes.visualizar', 'clientes.criar'],
      })
      .expect(200);

    const { body: sessao } = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: emailFuncionario, senha })
      .expect(200);

    const { body: cliente } = await autenticado(sessao.accessToken)
      .post('/api/clientes')
      .send({ nome: 'Cliente autorizado', camposPersonalizados: {}, etiquetas: [] })
      .expect(201);

    expect(cliente.nome).toBe('Cliente autorizado');
  });
});

function extrairTokenDoConvite(mensagem: MensagemNotificacao): string {
  const url = mensagem.corpo.match(/https?:\/\/\S+/)?.[0];
  if (!url) throw new Error('O e-mail de convite não contém uma URL.');

  const token = new URL(url).searchParams.get('token');
  if (!token) throw new Error('A URL de convite não contém o token.');

  return token;
}
