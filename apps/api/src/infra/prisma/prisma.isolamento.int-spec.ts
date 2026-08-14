import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { PrismaService } from './prisma.service';
import { runComTenant, tenantAtual, type TenantContext } from '../tenant/tenant-context';

/**
 * Testes de isolamento entre empresas.
 *
 * Estes são os testes mais importantes do projeto. Um bug de isolamento não se
 * anuncia: nada quebra, nenhum erro aparece no log — a empresa A simplesmente
 * começa a ver dado da empresa B. Só um teste que tenta ativamente atravessar a
 * fronteira detecta isso.
 *
 * Precisam de banco de verdade, porque o que está sendo testado é a Row-Level
 * Security do PostgreSQL. Um mock do Prisma testaria o mock.
 *
 * Rode com: pnpm --filter @gestao/api test:db
 */

const urlBanco = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? '';

let prisma: PrismaService;
let planoId: string;
let tenantA: string;
let tenantB: string;

/** Sufixo único por execução: dois testes rodando juntos não se atrapalham. */
const marca = randomUUID().slice(0, 8);

function contextoDe(tenantId: string): TenantContext {
  return {
    tenantId,
    usuarioId: randomUUID(),
    papel: 'admin',
    requestId: `teste-${marca}`,
  };
}

beforeAll(async () => {
  if (!urlBanco) {
    throw new Error('TEST_DATABASE_URL não definida. Rode scripts/setup-database.ps1.');
  }

  prisma = new PrismaService(urlBanco);
  await prisma.$connect();

  // `plano` é catálogo do produto, fora do escopo de tenant.
  const plano = await prisma.plano.create({
    data: { nome: `Teste ${marca}`, slug: `teste-${marca}`, preco: '10.00' },
  });
  planoId = plano.id;

  // As duas empresas do experimento, criadas pelo mesmo caminho do cadastro
  // self-service: o id é gerado na aplicação e vira o contexto antes do INSERT.
  tenantA = await prisma.criarNovoTenant(
    { nome: `Empresa A ${marca}`, plano: { connect: { id: planoId } } },
    (_tx, id) => Promise.resolve(id),
  );

  tenantB = await prisma.criarNovoTenant(
    { nome: `Empresa B ${marca}`, plano: { connect: { id: planoId } } },
    (_tx, id) => Promise.resolve(id),
  );
});

afterAll(async () => {
  if (!prisma) return;

  // Cada empresa precisa ser apagada dentro do próprio contexto: sem ele a RLS
  // não enxerga a linha, e o delete simplesmente não afeta nada. Apagar o
  // tenant leva junto tudo que depende dele (onDelete: Cascade).
  for (const tenantId of [tenantA, tenantB]) {
    if (!tenantId) continue;
    await prisma.comTenantExplicito(tenantId, (tx) =>
      tx.tenant.deleteMany({ where: { id: tenantId } }),
    );
  }

  // `plano` é catálogo do produto, fora da RLS.
  await prisma.plano.deleteMany({ where: { id: planoId } });
  await prisma.$disconnect();
});

describe('configuração da RLS no banco', () => {
  it('a aplicação conecta com um usuário SEM BYPASSRLS', async () => {
    // Se este teste falhar, todos os outros deste arquivo passam sem provar
    // nada: BYPASSRLS ignora todas as políticas, silenciosamente.
    const roles = await prisma.$queryRaw<{ rolbypassrls: boolean }[]>`
      SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user
    `;

    expect(roles[0]?.rolbypassrls).toBe(false);
  });

  it('toda tabela com tenant_id tem RLS habilitada, forçada e com política', async () => {
    // Cobertura automática: uma tabela nova entra nesta verificação sozinha.
    // Sem isso, uma migration futura poderia criar uma tabela sem política e
    // ninguém perceberia até o vazamento acontecer.
    const desprotegidas = await prisma.$queryRaw<{ tabela: string; motivo: string }[]>`
      SELECT c.relname AS tabela,
             CASE
               WHEN NOT c.relrowsecurity THEN 'RLS não habilitada'
               WHEN NOT c.relforcerowsecurity THEN 'RLS não forçada (o dono da tabela a ignoraria)'
               ELSE 'sem política'
             END AS motivo
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'tenant_id' AND NOT a.attisdropped
      WHERE n.nspname = 'public'
        AND c.relkind = 'r'
        AND (
          NOT c.relrowsecurity
          OR NOT c.relforcerowsecurity
          OR NOT EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid)
        )
      ORDER BY c.relname
    `;

    expect(desprotegidas).toEqual([]);
  });
});

describe('isolamento entre empresas', () => {
  it('cada empresa enxerga apenas os próprios clientes', async () => {
    await runComTenant(contextoDe(tenantA), () =>
      prisma.comTenant((tx) =>
        tx.cliente.create({ data: { nome: `Cliente de A ${marca}`, tenantId: tenantAtual() } }),
      ),
    );

    await runComTenant(contextoDe(tenantB), () =>
      prisma.comTenant((tx) =>
        tx.cliente.create({ data: { nome: `Cliente de B ${marca}`, tenantId: tenantAtual() } }),
      ),
    );

    const vistosPorA = await runComTenant(contextoDe(tenantA), () =>
      prisma.comTenant((tx) => tx.cliente.findMany()),
    );

    expect(vistosPorA).toHaveLength(1);
    expect(vistosPorA[0]?.nome).toBe(`Cliente de A ${marca}`);
  });

  it('não encontra registro de outra empresa nem sabendo o id exato', async () => {
    // O teste mais revelador do arquivo. `findUnique` busca pela chave primária,
    // e a extensão do Prisma não consegue filtrar por tenant nesse caso — ela
    // não tem onde encaixar a condição. Quem barra aqui é só a RLS.
    const clienteDeA = await runComTenant(contextoDe(tenantA), () =>
      prisma.comTenant((tx) =>
        tx.cliente.create({ data: { nome: `Alvo ${marca}`, tenantId: tenantAtual() } }),
      ),
    );

    const encontradoPorB = await runComTenant(contextoDe(tenantB), () =>
      prisma.comTenant((tx) => tx.cliente.findUnique({ where: { id: clienteDeA.id } })),
    );

    expect(encontradoPorB).toBeNull();
  });

  it('a extensão barra a gravação carimbada com outra empresa', async () => {
    // Camada 2: o erro sai da aplicação, com mensagem explicando o conflito
    // entre o tenant do contexto e o que foi escrito no `data`.
    await expect(
      runComTenant(contextoDe(tenantA), () =>
        prisma.comTenant((tx) =>
          tx.cliente.create({ data: { nome: `Invasor ${marca}`, tenantId: tenantB } }),
        ),
      ),
    ).rejects.toThrow(/só pode ser criado dentro da própria empresa/);
  });

  it('a RLS barra a gravação cruzada mesmo por SQL direto', async () => {
    // Camada 3, testada sem passar pela camada 2. Este é o cenário que importa:
    // se a extensão tiver bug, ou alguém escrever SQL na mão, o banco ainda
    // precisa recusar. É o papel do WITH CHECK na política — sem ele, daria
    // para plantar dado dentro da empresa alheia mesmo sem conseguir lê-lo.
    await expect(
      prisma.comTenantExplicito(
        tenantA,
        (tx) =>
          tx.$executeRaw`
          INSERT INTO cliente (id, tenant_id, nome, criado_em, atualizado_em)
          VALUES (gen_random_uuid(), ${tenantB}::uuid, ${`SQL cru ${marca}`}, now(), now())
        `,
      ),
    ).rejects.toThrow();
  });

  it('não altera registro de outra empresa', async () => {
    const clienteDeA = await runComTenant(contextoDe(tenantA), () =>
      prisma.comTenant((tx) =>
        tx.cliente.create({ data: { nome: `Original ${marca}`, tenantId: tenantAtual() } }),
      ),
    );

    const alterados = await runComTenant(contextoDe(tenantB), () =>
      prisma.comTenant((tx) =>
        tx.cliente.updateMany({
          where: { id: clienteDeA.id },
          data: { nome: 'Alterado por B' },
        }),
      ),
    );

    expect(alterados.count).toBe(0);

    const intacto = await runComTenant(contextoDe(tenantA), () =>
      prisma.comTenant((tx) => tx.cliente.findUnique({ where: { id: clienteDeA.id } })),
    );

    expect(intacto?.nome).toBe(`Original ${marca}`);
  });

  it('não apaga registro de outra empresa', async () => {
    const clienteDeA = await runComTenant(contextoDe(tenantA), () =>
      prisma.comTenant((tx) =>
        tx.cliente.create({ data: { nome: `Persistente ${marca}`, tenantId: tenantAtual() } }),
      ),
    );

    const apagados = await runComTenant(contextoDe(tenantB), () =>
      prisma.comTenant((tx) => tx.cliente.deleteMany({ where: { id: clienteDeA.id } })),
    );

    expect(apagados.count).toBe(0);

    const sobrevivente = await runComTenant(contextoDe(tenantA), () =>
      prisma.comTenant((tx) => tx.cliente.findUnique({ where: { id: clienteDeA.id } })),
    );

    expect(sobrevivente).not.toBeNull();
  });

  it('a contagem por empresa não soma registros da outra', async () => {
    // Agregações são um ponto cego clássico: mesmo quando a listagem está
    // correta, um COUNT sem filtro entregaria o volume de negócio do concorrente.
    const totalA = await runComTenant(contextoDe(tenantA), () =>
      prisma.comTenant((tx) => tx.cliente.count()),
    );
    const totalB = await runComTenant(contextoDe(tenantB), () =>
      prisma.comTenant((tx) => tx.cliente.count()),
    );

    expect(totalA).toBeGreaterThan(0);
    expect(totalB).toBe(1);
  });
});

describe('ausência de contexto', () => {
  it('recusa a consulta quando não há tenant no contexto', async () => {
    await expect(prisma.comTenant((tx) => tx.cliente.findMany())).rejects.toThrow(
      /fora de um contexto válido/,
    );
  });

  it('sem tenant definido no banco, nenhuma linha isolada é visível', async () => {
    // Prova que a RLS falha fechada: sem `app.current_tenant_id`, a política
    // não devolve nada, em vez de devolver tudo.
    const visiveis = await prisma.cliente.findMany();

    expect(visiveis).toEqual([]);
  });
});
