-- ============================================================================
--  Papel da aplicação — o que faz a RLS valer de verdade
--
--  POR QUE ESTE ARQUIVO EXISTE
--
--  A arquitetura §4.3 exige que a aplicação conecte com um usuário **sem**
--  `BYPASSRLS`, e o SECURITY.md manda validar isso antes de cada deploy. No
--  Neon (e em qualquer provedor que entregue um "owner" pronto), o papel padrão
--  vem com `rolbypassrls = true` — e BYPASSRLS **vence** tanto o `ENABLE` quanto
--  o `FORCE ROW LEVEL SECURITY`.
--
--  O efeito é silencioso e grave: as políticas continuam lá, corretas, e não
--  filtram nada. A camada 3 do isolamento deixa de existir, e as consultas que
--  a extensão do Prisma não cobre de propósito — `findUnique`, `update` e
--  `delete`, que buscam por chave única — ficam sem proteção alguma.
--
--  Isto **não é uma migration** e não deve rodar no `migrate deploy`: cria um
--  papel com senha, que é segredo e não pertence ao repositório. Rode uma vez
--  por ambiente, no SQL editor do provedor, conectado como o papel dono.
--
--  DEPOIS DE RODAR
--
--    1. No painel do Render (gestao-api > Environment):
--         DATABASE_URL        -> conexão do gestao_app   (a aplicação)
--         ADMIN_DATABASE_URL  -> conexão do papel dono   (migrations e seed)
--       A escolha entre as duas é automática — ver `src/config/url-banco.ts`.
--
--    2. Confirme com:  pnpm --filter @gestao/api check:isolamento
--       Ele recusa a conexão que tiver BYPASSRLS e prova que uma empresa não
--       enxerga a outra.
-- ============================================================================

-- ----------------------------------------------------------------------------
--  1. O papel
-- ----------------------------------------------------------------------------
--
--  TROQUE a senha abaixo antes de executar. Ela vai para o `DATABASE_URL` do
--  Render e para mais nenhum lugar — nunca para um arquivo do repositório.
--
--  `NOBYPASSRLS` é explícito de propósito. É o padrão do PostgreSQL, mas
--  escrever a palavra deixa a intenção registrada para quem ler depois — e é o
--  atributo cuja ausência causou o problema que este arquivo corrige.

CREATE ROLE gestao_app WITH LOGIN NOBYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE
  PASSWORD 'TROQUE-ESTA-SENHA';

-- ----------------------------------------------------------------------------
--  2. Privilégios sobre o que já existe
-- ----------------------------------------------------------------------------
--
--  Só DML. O papel não altera schema: quem faz isso são as migrations, que
--  rodam com a conexão administrativa.

GRANT USAGE ON SCHEMA public TO gestao_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO gestao_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO gestao_app;

-- ----------------------------------------------------------------------------
--  3. Privilégios sobre o que as próximas migrations criarem
-- ----------------------------------------------------------------------------
--
--  Sem isto, a primeira tabela de uma migration futura nasce inacessível à
--  aplicação, e o sintoma é um "permission denied for table" em produção — bem
--  depois do deploy que o causou.
--
--  `ALTER DEFAULT PRIVILEGES` vale para os objetos criados pelo papel que
--  executa este comando. Por isso ele precisa rodar como o mesmo papel que roda
--  as migrations.

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO gestao_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO gestao_app;

-- ----------------------------------------------------------------------------
--  4. Confirmação
-- ----------------------------------------------------------------------------

SELECT rolname, rolbypassrls, rolsuper, rolcanlogin
  FROM pg_roles
 WHERE rolname IN ('gestao_app', current_user);

-- `rolbypassrls` do gestao_app tem de vir `false`. Se vier `true`, pare: a RLS
-- continuaria inerte e trocar a variável no Render não resolveria nada.
