/**
 * Escolha da conexão usada por migrations e seed.
 *
 * Migrations precisam de permissão administrativa (alterar schema, criar
 * políticas), enquanto a aplicação roda com um usuário sem `BYPASSRLS`. Daí a
 * preferência pelo `ADMIN_DATABASE_URL`, com o `DATABASE_URL` como alternativa
 * onde só existe uma conexão — que é o caso do Render hoje.
 *
 * A regra importante está no `vazio()`: variável definida como string vazia
 * conta como ausente. Plataformas de deploy declaram variável opcional assim —
 * o `render.yaml` traz `ADMIN_DATABASE_URL: ''` — e um `??` sozinho aceitaria
 * esse vazio como valor válido, mandando `url: ''` para o Prisma. O deploy
 * então quebra com "Connection url is empty" no `migrate deploy`, apontando
 * para uma variável que quem lê o painel jura estar configurada.
 *
 * Sem dependências de propósito: este arquivo é carregado pelo
 * `prisma.config.ts`, que roda fora da aplicação, pela CLI do Prisma.
 */
function preenchida(valor: string | undefined): string | undefined {
  const limpo = valor?.trim();

  return limpo ? limpo : undefined;
}

/** Conexão para migrations e seed, ou `undefined` se nenhuma foi configurada. */
export function urlAdministrativa(
  env: Record<string, string | undefined> = process.env,
): string | undefined {
  // O banco isolado dos testes de integração vem primeiro: é o único caso em
  // que apontar para outro lugar é intencional.
  if (env['PRISMA_USE_TEST_DB'] === '1') {
    return preenchida(env['TEST_DATABASE_URL']);
  }

  return preenchida(env['ADMIN_DATABASE_URL']) ?? preenchida(env['DATABASE_URL']);
}
