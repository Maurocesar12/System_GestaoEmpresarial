import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { calcularAcesso, mensagemDeAcesso } from '@gestao/shared-types';
import { Prisma, PrismaClient } from '../src/generated/prisma/client';

/**
 * Mostra e estende o prazo de acesso de uma empresa.
 *
 * Existe porque o acesso vence sozinho e, até o Asaas entrar, não há caminho
 * pela interface: o aviso do painel tem um botão "Pagar" que leva a
 * `/painel/plano`, uma tela que só lista os planos. Quando `trialTerminaEm`
 * passa, `garantirAcessoEmDia()` devolve 402 no login **e** na renovação — a
 * conta fica trancada por fora, sem o que clicar.
 *
 * O cálculo do prazo não é reimplementado aqui: usa o mesmo `calcularAcesso`
 * de `shared-types` que a API usa para barrar e a tela usa para avisar. Se as
 * três divergissem, este comando mentiria justamente sobre o que ele existe
 * para consertar.
 *
 *   pnpm --filter @gestao/api acesso
 *   pnpm --filter @gestao/api acesso mauro@exemplo.com 90
 *   pnpm --filter @gestao/api acesso mauro@exemplo.com pago
 */

/**
 * A conexão **da aplicação**, e não a administrativa.
 *
 * A administrativa tem `BYPASSRLS`, e com ela este comando enxergaria empresa
 * que a aplicação não enxerga — o oposto do que se quer de uma ferramenta que
 * existe para conferir o que o usuário vê.
 */
function exigirConexao(): string {
  const url = process.env.DATABASE_URL?.trim();

  if (!url) {
    throw new Error('Defina DATABASE_URL em apps/api/.env (a conexão da aplicação).');
  }

  return url;
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: exigirConexao() }) });

async function comTenant<T>(
  tenantId: string,
  operacao: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}::text, true)`;
    return operacao(tx);
  });
}

/**
 * Empresas e o e-mail de contato de cada uma.
 *
 * A descoberta parte de `usuario` porque `tenant` não é legível sem contexto —
 * e é a política `usuario_login` que permite esta leitura. Empresa sem usuário
 * não aparece, o que não é perda: ninguém consegue entrar nela.
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

function situacaoDe(tenant: {
  status: string;
  trialTerminaEm: Date | null;
  ultimoPagamentoEm: Date | null;
}) {
  return calcularAcesso({
    status: tenant.status as never,
    trialTerminaEm: tenant.trialTerminaEm?.toISOString() ?? null,
    ultimoPagamentoEm: tenant.ultimoPagamentoEm?.toISOString() ?? null,
  });
}

async function main(): Promise<void> {
  const [emailInformado, prazo] = process.argv.slice(2);
  const porEmpresa = await descobrirEmpresas();

  if (porEmpresa.size === 0) {
    console.log('\nNenhuma empresa com usuário neste banco.\n');
    return;
  }

  console.log('\nAcesso por empresa:');

  const empresas: Array<{ id: string; nome: string; email: string }> = [];

  for (const [tenantId, email] of porEmpresa) {
    const tenant = await comTenant(tenantId, (tx) =>
      tx.tenant.findUnique({
        where: { id: tenantId },
        select: {
          id: true,
          nome: true,
          status: true,
          trialTerminaEm: true,
          ultimoPagamentoEm: true,
        },
      }),
    );

    if (!tenant) continue;

    empresas.push({ id: tenant.id, nome: tenant.nome, email });

    const situacao = situacaoDe(tenant);
    const marca = situacao.liberado ? 'ok     ' : 'BLOQUEADA';

    console.log(
      `\n  ${marca} ${tenant.nome}  ·  ${email}\n` +
        `    ${mensagemDeAcesso(situacao)}\n` +
        `    motivo: ${situacao.motivo}   dias restantes: ${situacao.diasRestantes ?? '—'}`,
    );
  }

  if (!emailInformado || !prazo) {
    console.log(
      '\nPara estender:  pnpm --filter @gestao/api acesso <e-mail> <dias>' +
        '\nPara marcar pagamento hoje:  pnpm --filter @gestao/api acesso <e-mail> pago\n',
    );
    return;
  }

  const alvo = empresas.find(
    (empresa) => empresa.email.toLowerCase() === emailInformado.trim().toLowerCase(),
  );

  if (!alvo) {
    throw new Error(`Nenhuma empresa com o e-mail "${emailInformado}". Veja a lista acima.`);
  }

  // "pago" marca a data de hoje, e o `calcularAcesso` concede um mês a partir
  // dela. É o mesmo efeito que o webhook do Asaas terá quando existir.
  if (prazo.toLowerCase() === 'pago') {
    const atualizada = await comTenant(alvo.id, (tx) =>
      tx.tenant.update({
        where: { id: alvo.id },
        data: { ultimoPagamentoEm: new Date() },
        select: { nome: true, status: true, trialTerminaEm: true, ultimoPagamentoEm: true },
      }),
    );

    console.log(`\n✔ ${atualizada.nome}: ${mensagemDeAcesso(situacaoDe(atualizada))}\n`);
    return;
  }

  const dias = Number(prazo);

  if (!Number.isInteger(dias) || dias <= 0 || dias > 3650) {
    throw new Error(`Prazo inválido: "${prazo}". Use um número de dias (1 a 3650) ou "pago".`);
  }

  const novoLimite = new Date();
  novoLimite.setUTCDate(novoLimite.getUTCDate() + dias);

  const atualizada = await comTenant(alvo.id, (tx) =>
    tx.tenant.update({
      where: { id: alvo.id },
      data: { trialTerminaEm: novoLimite },
      select: { nome: true, status: true, trialTerminaEm: true, ultimoPagamentoEm: true },
    }),
  );

  console.log(
    `\n✔ ${atualizada.nome}: teste estendido por ${dias} dia(s).\n` +
      `  ${mensagemDeAcesso(situacaoDe(atualizada))}\n`,
  );
}

main()
  .catch((erro: unknown) => {
    console.error(`\n✖ ${erro instanceof Error ? erro.message : String(erro)}\n`);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
