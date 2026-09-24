import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '../src/generated/prisma/client';

/**
 * Troca o plano de uma empresa, para testar o que muda entre Básico e Premium.
 *
 * Existe porque fazer isso pelo SQL editor do Neon não funciona: a RLS da
 * tabela `tenant` exige `app.current_tenant_id` no contexto, e o editor roda
 * cada comando numa conexão HTTP sem estado — o `set_config` morre antes do
 * `UPDATE`, que então não encontra a linha e devolve `UPDATE 0`, sem erro.
 *
 * Aqui o contexto e o `UPDATE` vivem na mesma transação, igual ao que o
 * `PrismaService.comTenant()` faz na aplicação. Nenhuma política é desligada.
 *
 * Sem argumento, só mostra o que existe no banco — inclusive o host da
 * conexão, que é o que revela se você está na branch que o app realmente lê.
 *
 * A empresa é identificada pelo **e-mail** de quem usa o sistema, e não pelo
 * id: os ids são UUID v7, que começam com o instante de criação, então duas
 * empresas cadastradas no mesmo minuto têm ids quase idênticos e copiar o
 * errado é fácil. O id continua aceito, para quem já o tem em mãos.
 *
 *   pnpm --filter @gestao/api plano
 *   pnpm --filter @gestao/api plano essencial mauro@exemplo.com
 *   pnpm --filter @gestao/api plano profissional mauro@exemplo.com
 */

/**
 * A conexão **da aplicação**, e não a administrativa.
 *
 * As duas chegariam ao mesmo lugar, mas a administrativa tem `BYPASSRLS` — e
 * com ela as contagens por empresa sairiam somando todas as empresas, porque
 * nenhuma política filtraria. Menor privilégio aqui não é só princípio: é o
 * que faz os números impressos estarem certos.
 */
function exigirConexao(): string {
  const url = process.env.DATABASE_URL?.trim();

  if (!url) {
    throw new Error(
      'Nenhuma conexão configurada: defina DATABASE_URL em apps/api/.env ' +
        '(copie o valor do painel do Render, em gestao-api > Environment).',
    );
  }

  return url;
}

const conexao = exigirConexao();

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: conexao }) });

/** O mesmo contrato de `PrismaService.comTenant()`: contexto e query na mesma transação. */
async function comTenant<T>(
  tenantId: string,
  operacao: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}::text, true)`;
    return operacao(tx);
  });
}

/** Host e banco da conexão, sem a senha — é o que identifica a branch do Neon. */
function descreverConexao(url: string): string {
  try {
    const { host, pathname } = new URL(url);
    return `${host}${pathname}`;
  } catch {
    return '(URL ilegível)';
  }
}

/**
 * Descobre as empresas a partir da tabela `usuario`, com um e-mail de contato.
 *
 * `tenant` não pode ser lida sem contexto, e o contexto é justamente o que
 * queremos descobrir. A saída é a política `usuario_login`, que permite ler
 * `usuario` quando não há tenant definido — o mesmo caminho que o login usa.
 *
 * A ordenação por `papel` traz o admin primeiro: no PostgreSQL um enum ordena
 * pela ordem de declaração, e `admin` é o primeiro valor de `papel_usuario`.
 */
async function descobrirEmpresas(): Promise<Map<string, string>> {
  const usuarios = await prisma.usuario.findMany({
    select: { tenantId: true, email: true },
    orderBy: [{ papel: 'asc' }, { criadoEm: 'asc' }],
  });

  const porEmpresa = new Map<string, string>();

  for (const usuario of usuarios) {
    if (!porEmpresa.has(usuario.tenantId)) {
      porEmpresa.set(usuario.tenantId, usuario.email);
    }
  }

  return porEmpresa;
}

/** Resolve o alvo informado na linha de comando: aceita e-mail ou o id da empresa. */
async function resolverAlvo(informado: string): Promise<string | undefined> {
  if (!informado.includes('@')) {
    return informado;
  }

  const usuario = await prisma.usuario.findUnique({
    where: { email: informado.trim().toLowerCase() },
    select: { tenantId: true },
  });

  return usuario?.tenantId;
}

async function main(): Promise<void> {
  const [slugDesejado, tenantInformado] = process.argv.slice(2);

  console.log(`\nConexão: ${descreverConexao(conexao)}\n`);

  const planos = await prisma.plano.findMany({
    select: { id: true, slug: true, nome: true, iaHabilitada: true },
    orderBy: { nivel: 'asc' },
  });

  if (planos.length === 0) {
    throw new Error('Catálogo de planos vazio. Rode `pnpm --filter @gestao/api db:seed` antes.');
  }

  console.log('Planos disponíveis:');
  for (const plano of planos) {
    console.log(`  ${plano.slug.padEnd(14)} ${plano.nome.padEnd(10)} IA: ${plano.iaHabilitada}`);
  }

  const porEmpresa = await descobrirEmpresas();

  if (porEmpresa.size === 0) {
    console.log(
      '\nNenhuma empresa encontrada neste banco.\n' +
        'É o sinal de que a conexão acima aponta para outra branch/banco — ' +
        'o app que você está usando lê outro lugar.\n',
    );
    return;
  }

  // Empresas sem nenhum usuário não aparecem, porque a descoberta parte da
  // tabela `usuario` — o único caminho que respeita a RLS. Não é perda: sem
  // usuário, ninguém consegue entrar naquela empresa.
  console.log('\nEmpresas com acesso (descobertas pelos usuários):');

  const empresas = [];
  for (const [tenantId, email] of porEmpresa) {
    const empresa = await comTenant(tenantId, async (tx) => {
      const tenant = await tx.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true, nome: true, status: true, plano: { select: { slug: true } } },
      });
      const clientes = await tx.cliente.count();
      return tenant ? { ...tenant, clientes } : null;
    });

    if (empresa) {
      empresas.push(empresa);
      console.log(
        `\n  ${empresa.nome}  ·  ${email}\n` +
          `    plano: ${empresa.plano.slug.padEnd(14)} status: ${String(empresa.status).padEnd(10)}` +
          ` clientes: ${empresa.clientes}\n` +
          `    tenant_id: ${empresa.id}`,
      );
    }
  }

  if (!slugDesejado) {
    console.log('\nPara trocar: pnpm --filter @gestao/api plano <slug> <e-mail>\n');
    return;
  }

  const plano = planos.find((item) => item.slug === slugDesejado);

  if (!plano) {
    throw new Error(
      `Plano "${slugDesejado}" não existe. Use um destes: ${planos.map((p) => p.slug).join(', ')}`,
    );
  }

  // Com uma empresa só, exigir o identificador seria burocracia; com várias,
  // escolher por conta própria seria adivinhação.
  const alvo = tenantInformado
    ? await resolverAlvo(tenantInformado)
    : empresas.length === 1
      ? empresas[0]!.id
      : undefined;

  if (!alvo) {
    throw new Error(
      tenantInformado
        ? `Nenhum usuário com o e-mail "${tenantInformado}". Use um dos e-mails da lista acima.`
        : 'Há mais de uma empresa: informe o e-mail do usuário como segundo argumento.',
    );
  }

  if (!empresas.some((empresa) => empresa.id === alvo)) {
    throw new Error(`A empresa ${alvo} não existe neste banco. Veja a lista acima.`);
  }

  const atualizada = await comTenant(alvo, (tx) =>
    tx.tenant.update({
      where: { id: alvo },
      data: { planoId: plano.id },
      select: { nome: true, plano: { select: { slug: true, nome: true, iaHabilitada: true } } },
    }),
  );

  console.log(
    `\n✔ ${atualizada.nome} agora está no plano ${atualizada.plano.nome} ` +
      `(${atualizada.plano.slug}), IA ${atualizada.plano.iaHabilitada ? 'habilitada' : 'desabilitada'}.\n` +
      'Recarregue a página — o plano é lido do banco a cada requisição, sem cache.\n',
  );
}

main()
  .catch((erro: unknown) => {
    console.error(`\n✖ ${erro instanceof Error ? erro.message : String(erro)}\n`);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
