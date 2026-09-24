import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { urlAdministrativa } from '../src/config/url-banco';
import { PrismaClient } from '../src/generated/prisma/client';

/**
 * Cria o papel restrito com que a aplicação deve falar com o banco.
 *
 * É o `papel-aplicacao.sql` automatizado. O SQL continua valendo para quem
 * prefere colar no editor do provedor; este script existe porque a versão
 * manual tem três passos fáceis de errar: escolher uma senha que sobreviva
 * dentro de uma URL, não esquecer nenhum `GRANT`, e montar a connection string
 * nova sem trocar host ou `sslmode` sem querer.
 *
 * ## Por que o papel precisa existir
 *
 * O papel que o provedor entrega pronto — `neondb_owner`, no Neon — tem
 * `BYPASSRLS`, e BYPASSRLS **vence** tanto o `ENABLE` quanto o `FORCE ROW
 * LEVEL SECURITY`. Com ele, as políticas existem, estão corretas e não filtram
 * nada: a terceira camada do isolamento simplesmente não roda.
 *
 * ## O que ele NÃO faz
 *
 * Não troca a variável de ambiente. Criar o papel é aditivo e não muda o
 * comportamento de nada; apontar a aplicação para ele é a decisão, e ela é
 * sua — no Render e no `.env` local.
 *
 *   pnpm --filter @gestao/api criar:papel
 */

/** Só o que atravessa uma URL sem escape. Conferido antes de ir para o SQL. */
const SENHA_SEGURA = /^[A-Za-z0-9_-]{24,}$/;
const PAPEL = 'gestao_app';

function exigirConexao(): string {
  const url = urlAdministrativa();

  if (!url) {
    throw new Error('Defina ADMIN_DATABASE_URL (ou DATABASE_URL) com a conexão do papel dono.');
  }

  return url;
}

const conexao = exigirConexao();
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: conexao }) });

/** A mesma URL, trocando usuário e senha — host, banco e parâmetros intactos. */
function montarConexao(base: string, usuario: string, senha: string): string {
  const url = new URL(base);
  url.username = usuario;
  url.password = senha;
  return url.toString();
}

async function main(): Promise<void> {
  const [papelAtual] = await prisma.$queryRaw<
    Array<{ rolname: string; rolcreaterole: boolean; rolbypassrls: boolean }>
  >`SELECT rolname, rolcreaterole, rolbypassrls FROM pg_roles WHERE rolname = current_user`;

  console.log(`\nConectado como: ${papelAtual?.rolname ?? '?'}`);

  if (!papelAtual?.rolcreaterole) {
    throw new Error(
      `O papel ${papelAtual?.rolname ?? 'atual'} não pode criar papéis. ` +
        'Crie "gestao_app" pelo painel do provedor (no Neon: Roles > New Role) e depois ' +
        'rode apenas os GRANT de prisma/papel-aplicacao.sql.',
    );
  }

  const existentes = await prisma.$queryRaw<Array<{ rolname: string }>>`
    SELECT rolname FROM pg_roles WHERE rolname = ${PAPEL}
  `;

  const senha = randomBytes(24).toString('base64url');

  if (!SENHA_SEGURA.test(senha)) {
    throw new Error('Senha gerada fora do conjunto seguro. Rode de novo.');
  }

  if (existentes.length > 0) {
    // Não troca a senha de um papel que já existe: se ele já está em uso em
    // algum lugar, trocar derrubaria aquela conexão sem aviso.
    console.log(
      `\nO papel ${PAPEL} já existe — senha preservada.\n` +
        'Os GRANT abaixo são reaplicados (são idempotentes).',
    );
  } else {
    await prisma.$executeRawUnsafe(
      `CREATE ROLE ${PAPEL} WITH LOGIN NOBYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD '${senha}'`,
    );
    console.log(`\nPapel ${PAPEL} criado.`);
  }

  // Só DML: quem altera schema são as migrations, com a conexão administrativa.
  const concessoes = [
    `GRANT USAGE ON SCHEMA public TO ${PAPEL}`,
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${PAPEL}`,
    `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${PAPEL}`,
    // Sem isto, a primeira tabela de uma migration futura nasce inacessível à
    // aplicação — e o sintoma é "permission denied" em produção, muito depois
    // do deploy que causou.
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${PAPEL}`,
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${PAPEL}`,
  ];

  for (const comando of concessoes) {
    await prisma.$executeRawUnsafe(comando);
  }

  console.log(`Privilégios aplicados (${concessoes.length} comandos).`);

  const [conferencia] = await prisma.$queryRaw<
    Array<{ rolbypassrls: boolean; rolsuper: boolean }>
  >`SELECT rolbypassrls, rolsuper FROM pg_roles WHERE rolname = ${PAPEL}`;

  console.log(
    `\nConferência: ${PAPEL} bypassrls=${String(conferencia?.rolbypassrls)} ` +
      `superuser=${String(conferencia?.rolsuper)}  (os dois precisam ser false)`,
  );

  if (existentes.length === 0) {
    console.log('\n--- DATABASE_URL da aplicação (anote: não será exibida de novo) ---');
    console.log(montarConexao(conexao, PAPEL, senha));
    console.log('\nProximos passos:');
    console.log('  1. Render > gestao-api > Environment:');
    console.log('       DATABASE_URL       = a URL acima');
    console.log('       ADMIN_DATABASE_URL = a conexão do papel dono (migrations)');
    console.log('  2. Mesmo par no apps/api/.env local');
    console.log('  3. pnpm --filter @gestao/api check:isolamento');
  }
}

main()
  .catch((erro: unknown) => {
    console.error(`\n✖ ${erro instanceof Error ? erro.message : String(erro)}\n`);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
