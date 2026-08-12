-- ============================================================================
--  Cria o banco de desenvolvimento e os dois roles que a aplicação usa.
--
--  Rode este arquivo pelo script `setup-database.ps1`, que gera as senhas e
--  as repassa como variáveis. Nenhuma senha vive dentro deste arquivo — ele é
--  versionado.
--
--  POR QUE DOIS ROLES?
--
--  O isolamento entre empresas depende do Row-Level Security do PostgreSQL
--  (arquitetura §4.2). Mas a RLS tem uma exceção: quem tem o atributo
--  BYPASSRLS ignora todas as políticas, como se elas não existissem.
--
--  Então separamos:
--    - `gestao_app`    SEM BYPASSRLS. É por onde a aplicação fala com o banco.
--                      Sujeito às políticas, sempre.
--    - `gestao_admin`  COM BYPASSRLS. Só para o painel interno, que precisa
--                      enxergar todos os tenants para dar suporte.
--
--  Se a aplicação usasse um role com BYPASSRLS, as políticas de RLS seriam
--  ignoradas em silêncio — e os testes de isolamento passariam sem provar nada.
-- ============================================================================

-- Os comandos abaixo usam `\gexec`: o psql roda o SELECT e executa o texto que
-- ele devolver. O padrão parece indireto, mas resolve duas coisas de uma vez.
--
-- A primeira é tornar o script repetível — o WHERE decide entre criar e
-- atualizar, e rodar duas vezes não gera erro.
--
-- A segunda é uma limitação do psql que não é óbvia: ele **não** substitui
-- variáveis (`:'senha_app'`) dentro de textos delimitados por `$$`. Um bloco
-- `DO $$ ... $$` receberia os dois-pontos literalmente e falharia com erro de
-- sintaxe. Fora do `$$`, como aqui, a substituição acontece normalmente.
--
-- `%L` no format() escapa a senha como literal SQL, então qualquer caractere
-- dentro dela é seguro.

-- NOBYPASSRLS é o padrão do PostgreSQL, mas está explícito de propósito: é a
-- garantia mais importante deste arquivo e não deve depender de default.
SELECT format('CREATE ROLE gestao_app WITH LOGIN NOBYPASSRLS PASSWORD %L', :'senha_app')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'gestao_app')
\gexec

SELECT format('ALTER ROLE gestao_app WITH LOGIN NOBYPASSRLS PASSWORD %L', :'senha_app')
WHERE EXISTS (SELECT FROM pg_roles WHERE rolname = 'gestao_app')
\gexec

SELECT format('CREATE ROLE gestao_admin WITH LOGIN BYPASSRLS PASSWORD %L', :'senha_admin')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'gestao_admin')
\gexec

SELECT format('ALTER ROLE gestao_admin WITH LOGIN BYPASSRLS PASSWORD %L', :'senha_admin')
WHERE EXISTS (SELECT FROM pg_roles WHERE rolname = 'gestao_admin')
\gexec

-- CREATE DATABASE não pode rodar dentro de um bloco DO nem de uma transação,
-- por isso o \gexec: ele executa o SELECT e, se houver resultado, roda o texto.
SELECT 'CREATE DATABASE gestao_dev OWNER gestao_app'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'gestao_dev')
\gexec

-- Banco separado para os testes automatizados. Os testes de isolamento apagam e
-- recriam dados, e não podem competir com o que você está usando no navegador.
SELECT 'CREATE DATABASE gestao_test OWNER gestao_app'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'gestao_test')
\gexec

-- A partir daqui, dentro de cada banco: permissões do role do painel interno.
\connect gestao_dev

-- Ser dono do banco não torna `gestao_app` dono do schema `public`, e a partir
-- do PostgreSQL 15 esse schema não concede CREATE a qualquer um. Sem isto, a
-- primeira migration falharia com "permission denied for schema public".
ALTER SCHEMA public OWNER TO gestao_app;

GRANT CONNECT ON DATABASE gestao_dev TO gestao_admin;
GRANT USAGE ON SCHEMA public TO gestao_admin;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO gestao_admin;

-- Sem isto, cada tabela nova criada por uma migration futura ficaria invisível
-- para o painel interno até alguém lembrar de rodar o GRANT na mão.
ALTER DEFAULT PRIVILEGES FOR ROLE gestao_app IN SCHEMA public
  GRANT SELECT ON TABLES TO gestao_admin;

\connect gestao_test

ALTER SCHEMA public OWNER TO gestao_app;

GRANT CONNECT ON DATABASE gestao_test TO gestao_admin;
GRANT USAGE ON SCHEMA public TO gestao_admin;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO gestao_admin;

ALTER DEFAULT PRIVILEGES FOR ROLE gestao_app IN SCHEMA public
  GRANT SELECT ON TABLES TO gestao_admin;
