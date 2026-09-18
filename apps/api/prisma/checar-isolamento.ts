import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '../src/generated/prisma/client';

/**
 * Prova que o isolamento entre empresas está de pé **nesta conexão**.
 *
 * O `SECURITY.md` manda validar, antes de cada deploy, que o `DATABASE_URL`
 * usa um usuário sem `BYPASSRLS`. Esse item era uma frase que ninguém
 * executava — e a consequência apareceu em produção: o papel padrão do Neon
 * tem `rolbypassrls = true`, e com ele as políticas de RLS existem, estão
 * corretas e não filtram nada.
 *
 * O teste da suíte (`prisma.isolamento.int-spec.ts`) não pega isso porque o CI
 * cria o papel com `NOBYPASSRLS` de propósito: lá ele fica verde justamente por
 * estar num ambiente correto. Este script é o que faltava — ele olha a conexão
 * de verdade, a que a aplicação usa.
 *
 * Lê `DATABASE_URL` diretamente, e não `urlAdministrativa()`: a conexão
 * administrativa **deve** ter BYPASSRLS, então checá-la não diria nada.
 *
 *   pnpm --filter @gestao/api check:isolamento
 */

const IDENTIFICADOR = /^[a-z_][a-z0-9_]*$/;

/**
 * Tabelas que podem devolver linha sem contexto, cada uma por um motivo escrito
 * na migration que criou a política.
 *
 * A lista é fechada de propósito: se amanhã alguém abrir uma política que vaze
 * sem contexto, a tabela aparece fora desta lista e o script reprova.
 */
const EXCECOES = new Map<string, string>([
  ['usuario', 'usuario_login — o login acha a pessoa antes de saber a empresa'],
  ['tenant', 'tenant_expurgo — só empresas canceladas, para a rotina de exclusão'],
  ['lembrete_follow_up', 'lembrete_varredura — a varredura roda sem ninguém logado'],
]);

function exigirConexao(): string {
  const url = process.env.DATABASE_URL?.trim();

  if (!url) {
    throw new Error('DATABASE_URL não definida. Aponte-a para a conexão da aplicação.');
  }

  return url;
}

const conexao = exigirConexao();
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: conexao }) });

const falhas: string[] = [];

function verificar(condicao: boolean, descricao: string, detalhe = ''): void {
  if (condicao) {
    console.log(`  ok    ${descricao}`);
    return;
  }

  falhas.push(descricao);
  console.log(`  FALHA ${descricao}${detalhe ? ` — ${detalhe}` : ''}`);
}

/**
 * Roda `operacao` com o tenant no contexto.
 *
 * O `tx` é repassado de propósito: `set_config(..., true)` vale só dentro desta
 * transação, então uma consulta feita no cliente global — fora dela — não veria
 * contexto nenhum e o teste mediria a coisa errada.
 */
async function comTenant<T>(
  tenantId: string,
  operacao: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}::text, true)`;
    return operacao(tx);
  });
}

/** `count(*)` numa tabela descoberta pelo catálogo. */
async function contar(
  cliente: Pick<Prisma.TransactionClient, '$queryRawUnsafe'>,
  tabela: string,
): Promise<number> {
  // O nome vem do catálogo do banco, não de entrada de usuário — a checagem
  // existe para que continue assim se alguém mudar a origem da lista.
  if (!IDENTIFICADOR.test(tabela)) {
    throw new Error(`Nome de tabela inesperado: ${tabela}`);
  }

  const linhas = await cliente.$queryRawUnsafe<Array<{ total: number }>>(
    `SELECT count(*)::int AS total FROM "${tabela}"`,
  );

  return linhas[0]?.total ?? 0;
}

async function main(): Promise<void> {
  const { host, pathname, username } = new URL(conexao);
  console.log(`\nConexão: ${username}@${host}${pathname}\n`);

  console.log('1. Papel da conexão');

  const papeis = await prisma.$queryRaw<
    Array<{ rolname: string; rolbypassrls: boolean; rolsuper: boolean }>
  >`SELECT rolname, rolbypassrls, rolsuper FROM pg_roles WHERE rolname = current_user`;

  const papel = papeis[0];
  verificar(papel !== undefined, 'o papel atual foi encontrado no catálogo');
  verificar(
    papel?.rolbypassrls === false,
    'o papel NÃO tem BYPASSRLS',
    papel?.rolbypassrls ? `${papel.rolname} ignora toda política de RLS` : '',
  );
  verificar(
    papel?.rolsuper === false,
    'o papel NÃO é superusuário',
    papel?.rolsuper ? `${papel.rolname} é superusuário e ignora RLS` : '',
  );

  console.log('\n2. Cobertura de RLS nas tabelas com tenant_id');

  const tabelas = await prisma.$queryRaw<
    Array<{ tabela: string; ligada: boolean; forcada: boolean; politicas: number }>
  >`
    SELECT c.relname                        AS tabela,
           c.relrowsecurity                 AS ligada,
           c.relforcerowsecurity            AS forcada,
           (SELECT count(*)::int FROM pg_policy p WHERE p.polrelid = c.oid) AS politicas
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.oid
     WHERE n.nspname = 'public' AND c.relkind = 'r'
       AND a.attname = 'tenant_id' AND NOT a.attisdropped
     ORDER BY c.relname
  `;

  verificar(tabelas.length > 0, 'existem tabelas com tenant_id para checar');

  const semRls = tabelas.filter(
    (tabela) => !tabela.ligada || !tabela.forcada || tabela.politicas === 0,
  );
  verificar(
    semRls.length === 0,
    `todas as ${tabelas.length} tabelas têm RLS ligada, forçada e com política`,
    semRls.map((tabela) => tabela.tabela).join(', '),
  );

  console.log('\n3. Consulta sem contexto de empresa');

  for (const { tabela } of tabelas) {
    const total = await contar(prisma, tabela);
    const motivo = EXCECOES.get(tabela);

    if (motivo) {
      console.log(`  -     ${tabela}: ${total} (exceção conhecida — ${motivo})`);
      continue;
    }

    verificar(total === 0, `${tabela} não devolve linha sem contexto`, `devolveu ${total}`);
  }

  console.log('\n4. Consulta com contexto de empresa');

  const empresas = await prisma.usuario.findMany({
    select: { tenantId: true },
    distinct: ['tenantId'],
    take: 2,
  });

  if (empresas.length < 2) {
    console.log('  -     menos de duas empresas neste banco: teste cruzado dispensado');
  } else {
    const primeira = empresas[0]!.tenantId;
    const segunda = empresas[1]!.tenantId;

    const totalA = await comTenant(primeira, (tx) => contar(tx, 'cliente'));
    const totalB = await comTenant(segunda, (tx) => contar(tx, 'cliente'));
    const semEscopo = await contar(prisma, 'cliente');

    console.log(
      `  -     clientes: empresa A=${totalA}, empresa B=${totalB}, sem contexto=${semEscopo}`,
    );
    verificar(
      semEscopo === 0,
      'sem contexto, nenhuma linha de cliente aparece',
      `devolveu ${semEscopo}`,
    );

    // O teste que importa: `findUnique` por id é justamente o que a extensão do
    // Prisma não filtra, por buscar por chave única. Quem barra é a RLS.
    const alvo = await comTenant(primeira, (tx) => tx.cliente.findFirst({ select: { id: true } }));

    if (!alvo) {
      console.log('  -     a empresa A não tem cliente: teste de findUnique dispensado');
    } else {
      const invasao = await comTenant(segunda, (tx) =>
        tx.cliente.findUnique({ where: { id: alvo.id }, select: { id: true } }),
      );

      verificar(
        invasao === null,
        'findUnique com o id exato de outra empresa não devolve a linha',
        invasao ? 'devolveu o registro — vazamento entre empresas' : '',
      );
    }
  }

  console.log(
    falhas.length === 0
      ? '\n✔ Isolamento de pé nesta conexão.\n'
      : `\n✖ ${falhas.length} verificação(ões) falharam. Esta conexão NÃO isola as empresas.\n`,
  );

  if (falhas.length > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((erro: unknown) => {
    console.error(`\n✖ ${erro instanceof Error ? erro.message : String(erro)}\n`);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
