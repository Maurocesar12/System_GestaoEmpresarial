import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

/**
 * Redefine a verificação em duas etapas de uma pessoa, pelo e-mail.
 *
 * Pela interface, quem redefine é o administrador da empresa (Equipe → Editar
 * acesso). Este comando é para quando não há quem faça isso: o único admin
 * perdeu o celular **e** os códigos de recuperação. Confira a identidade da
 * pessoa por outro canal antes de rodar — é exatamente o pedido que um
 * golpista faria.
 *
 *   pnpm --filter @gestao/api 2fa:redefinir maria@empresa.com
 *
 * Usa a conexão da aplicação, com as mesmas políticas de RLS da API: acha a
 * pessoa pela política de login e altera já dentro do contexto da empresa dela.
 */
function exigirConexao(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error('Defina DATABASE_URL em apps/api/.env (a conexão da aplicação).');
  return url;
}

async function main(): Promise<void> {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.log('Uso: pnpm --filter @gestao/api 2fa:redefinir <e-mail>');
    process.exitCode = 1;
    return;
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: exigirConexao() }),
  });

  try {
    const usuario = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.login_email', ${email}::text, true)`;
      return tx.usuario.findUnique({
        where: { email },
        select: { id: true, tenantId: true, nome: true, doisFatoresAtivadoEm: true },
      });
    });

    if (!usuario) {
      console.log(`Nenhum usuário com o e-mail ${email}.`);
      process.exitCode = 1;
      return;
    }

    const sessoes = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${usuario.tenantId}::text, true)`;
      await tx.usuario.update({
        where: { id: usuario.id },
        data: {
          doisFatoresSegredo: null,
          doisFatoresAtivadoEm: null,
          doisFatoresUltimoPasso: null,
          doisFatoresRecuperacao: [],
          doisFatoresFalhas: 0,
          doisFatoresBloqueadoAte: null,
        },
        select: { id: true },
      });
      // Sessões abertas caem junto: quem estava com o celular perdido não
      // continua dentro.
      const { count } = await tx.refreshToken.deleteMany({ where: { usuarioId: usuario.id } });
      return count;
    });

    console.log(
      `2FA de ${usuario.nome} (${email}) redefinido` +
        `${usuario.doisFatoresAtivadoEm ? '' : ' (já não estava configurado)'}. ` +
        `${sessoes} sessão(ões) encerrada(s). O próximo login pede a configuração do app.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

void main();
