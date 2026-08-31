import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { uuidv7 } from '../../../../common/uuid';
import { PrismaService } from '../../../../infra/prisma/prisma.service';

/**
 * Testes da política `lembrete_varredura`.
 *
 * Esta política é a única brecha de leitura sem contexto fora da tabela
 * `usuario`, e existe para o agendador conseguir achar lembretes vencidos de
 * todas as empresas (ver a migration `20260831120000_lembrete_varredura`).
 *
 * Uma brecha só é segura enquanto for do tamanho que se pretendia. É isso que
 * este arquivo mede: que ela abre o **mínimo** — leitura, sem contexto, apenas
 * de linhas pendentes — e nada além disso.
 *
 * Rode com: pnpm --filter @gestao/api test:db
 */

const urlBanco = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? '';

const marca = randomUUID().slice(0, 8);

let prisma: PrismaService;
let planoId: string;
let tenantA: string;
let tenantB: string;
let pendenteA: string;
let pendenteB: string;
let canceladoA: string;

/** Cria um cliente e um lembrete dentro do escopo da empresa informada. */
async function criarLembrete(
  tenantId: string,
  status: 'pendente' | 'cancelado',
  dataEnvio: Date,
): Promise<string> {
  return prisma.comTenantExplicito(tenantId, async (tx) => {
    const cliente = await tx.cliente.create({
      data: { id: uuidv7(), tenantId, nome: `Cliente ${marca}` },
    });

    const lembrete = await tx.lembreteFollowUp.create({
      data: {
        id: uuidv7(),
        tenantId,
        clienteId: cliente.id,
        canal: 'email',
        status,
        dataEnvio,
      },
    });

    return lembrete.id;
  });
}

beforeAll(async () => {
  if (!urlBanco) {
    throw new Error('TEST_DATABASE_URL não definida. Rode scripts/setup-database.ps1.');
  }

  prisma = new PrismaService(urlBanco);
  await prisma.$connect();

  const plano = await prisma.plano.create({
    data: { nome: `Varredura ${marca}`, slug: `varredura-${marca}`, preco: '10.00' },
  });
  planoId = plano.id;

  tenantA = await prisma.criarNovoTenant(
    { nome: `Empresa A ${marca}`, plano: { connect: { id: planoId } } },
    (_tx, id) => Promise.resolve(id),
  );

  tenantB = await prisma.criarNovoTenant(
    { nome: `Empresa B ${marca}`, plano: { connect: { id: planoId } } },
    (_tx, id) => Promise.resolve(id),
  );

  const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000);

  pendenteA = await criarLembrete(tenantA, 'pendente', ontem);
  pendenteB = await criarLembrete(tenantB, 'pendente', ontem);
  canceladoA = await criarLembrete(tenantA, 'cancelado', ontem);
});

afterAll(async () => {
  if (!prisma) return;

  for (const tenantId of [tenantA, tenantB]) {
    if (!tenantId) continue;
    await prisma.comTenantExplicito(tenantId, (tx) =>
      tx.tenant.deleteMany({ where: { id: tenantId } }),
    );
  }

  await prisma.plano.deleteMany({ where: { id: planoId } });
  await prisma.$disconnect();
});

/** Ids visíveis para a varredura, que roda sem contexto de tenant. */
async function idsVisiveisSemContexto(): Promise<string[]> {
  const linhas = await prisma.lembreteFollowUp.findMany({ select: { id: true } });

  return linhas.map((linha) => linha.id);
}

describe('política lembrete_varredura', () => {
  it('deixa a varredura enxergar pendentes de todas as empresas', async () => {
    // É a razão de a política existir: sem isso o agendador não acha nada e
    // nenhum lembrete jamais sai.
    const visiveis = await idsVisiveisSemContexto();

    expect(visiveis).toEqual(expect.arrayContaining([pendenteA, pendenteB]));
  });

  it('não expõe lembrete que já saiu do estado pendente', async () => {
    // O `USING` da política restringe a `status = 'pendente'`; o histórico de
    // enviados, falhados e cancelados continua fora de alcance.
    const visiveis = await idsVisiveisSemContexto();

    expect(visiveis).not.toContain(canceladoA);
  });

  it('não vaza o lembrete de uma empresa para outra empresa logada', async () => {
    // Com contexto definido, `app_current_tenant_id() IS NULL` é falso e sobra
    // apenas a política de isolamento. A brecha vale para o worker, nunca para
    // um usuário autenticado.
    const visiveisParaA = await prisma.comTenantExplicito(tenantA, (tx) =>
      tx.lembreteFollowUp.findMany({ select: { id: true } }),
    );

    const ids = visiveisParaA.map((linha) => linha.id);

    expect(ids).toContain(pendenteA);
    expect(ids).not.toContain(pendenteB);
  });

  it('não permite gravar sem contexto de tenant', async () => {
    // A política é `FOR SELECT`. Marcar o lembrete como enviado continua
    // exigindo o escopo da empresa — é o worker que o define, a partir do job.
    const afetados = await prisma.lembreteFollowUp.updateMany({
      where: { id: pendenteA },
      data: { status: 'enviado' },
    });

    expect(afetados.count).toBe(0);

    const aindaPendente = await prisma.comTenantExplicito(tenantA, (tx) =>
      tx.lembreteFollowUp.findUnique({ where: { id: pendenteA }, select: { status: true } }),
    );

    expect(aindaPendente?.status).toBe('pendente');
  });

  it('não permite apagar sem contexto de tenant', async () => {
    const afetados = await prisma.lembreteFollowUp.deleteMany({ where: { id: pendenteB } });

    expect(afetados.count).toBe(0);
  });
});
