-- ============================================================================
--  Row-Level Security — a terceira camada do isolamento entre empresas
--
--  CONTEXTO
--
--  Todas as empresas dividem as mesmas tabelas, separadas pela coluna
--  `tenant_id`. O risco desse modelo é um `WHERE tenant_id` esquecido devolver
--  dado da empresa errada. A defesa tem três camadas (arquitetura §4.2):
--
--    1. Contexto por requisição (AsyncLocalStorage), no código
--    2. Prisma Client Extension, que injeta o filtro automaticamente
--    3. Row-Level Security — ESTE ARQUIVO
--
--  As duas primeiras vivem na aplicação e podem ter bug. Esta é a última:
--  mesmo que o código erre, o banco se recusa a devolver a linha.
--
--  COMO FUNCIONA
--
--  Antes de cada consulta, a aplicação executa:
--      SET LOCAL app.current_tenant_id = '<uuid do tenant>';
--
--  As políticas abaixo comparam `tenant_id` com esse valor. Uma linha de outra
--  empresa simplesmente não existe do ponto de vista da consulta — não é um
--  erro de permissão, ela some do resultado.
--
--  POR QUE `FORCE` E NÃO SÓ `ENABLE`
--
--  Esta é a pegadinha que faz o isolamento falhar em silêncio: no PostgreSQL,
--  o **dono da tabela ignora as políticas de RLS**. Como o role `gestao_app` é
--  quem roda as migrations, ele é o dono de tudo — e sem `FORCE`, a RLS não
--  valeria justamente para a conexão da aplicação. `ENABLE` liga a RLS;
--  `FORCE` a aplica também ao dono.
-- ============================================================================

-- ----------------------------------------------------------------------------
--  Função que lê o tenant do contexto da conexão
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION app_current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  -- O segundo argumento `true` significa "não falhe se a variável não existir",
  -- devolvendo NULL. E NULL aqui é o que queremos: nas políticas abaixo,
  -- `tenant_id = NULL` nunca é verdadeiro, então a ausência de contexto não
  -- libera nada — ela bloqueia tudo. Falha fechada, não aberta.
  SELECT NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
$$;

COMMENT ON FUNCTION app_current_tenant_id() IS
  'Tenant da conexão atual, definido via SET LOCAL app.current_tenant_id. NULL quando não há contexto.';

-- ----------------------------------------------------------------------------
--  Políticas das tabelas de negócio
-- ----------------------------------------------------------------------------
--
--  O laço abaixo aplica a mesma política a todas as tabelas que têm a coluna
--  `tenant_id`. Escrever tabela por tabela seria mais explícito, mas bastaria
--  esquecer uma para abrir um buraco — e a lista vai crescer a cada fatia.
--  Descobrir as tabelas pelo catálogo do próprio banco não deixa nenhuma para
--  trás. O teste de cobertura em `rls.spec.ts` confirma o resultado.

DO $$
DECLARE
  tabela text;
BEGIN
  FOR tabela IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND a.attname = 'tenant_id'
      AND NOT a.attisdropped
    ORDER BY c.relname
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tabela);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tabela);

    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', tabela);

    -- USING     filtra o que a consulta enxerga (SELECT, UPDATE, DELETE).
    -- WITH CHECK valida o que a consulta grava (INSERT, UPDATE) — sem ele,
    --            seria possível inserir uma linha carimbada com o tenant de
    --            outra empresa.
    EXECUTE format($politica$
      CREATE POLICY tenant_isolation ON %I
        FOR ALL
        USING (tenant_id = app_current_tenant_id())
        WITH CHECK (tenant_id = app_current_tenant_id())
    $politica$, tabela);

    RAISE NOTICE 'RLS aplicada em %', tabela;
  END LOOP;
END
$$;

-- ----------------------------------------------------------------------------
--  Tabela `tenant` — a raiz, que não tem coluna `tenant_id`
-- ----------------------------------------------------------------------------

ALTER TABLE "tenant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON "tenant";

-- Aqui a comparação é com a própria chave primária: uma empresa só enxerga o
-- seu próprio registro.
CREATE POLICY tenant_isolation ON "tenant"
  FOR ALL
  USING (id = app_current_tenant_id())
  WITH CHECK (id = app_current_tenant_id());

DROP POLICY IF EXISTS tenant_signup ON "tenant";

-- Exceção necessária para o cadastro self-service: no instante em que a empresa
-- é criada, ela ainda não existe, então não há contexto de tenant a definir.
-- Esta política permite **apenas o INSERT**, e apenas quando não há contexto
-- algum. Depois de criada, o fluxo define o contexto e volta à regra normal.
--
-- Políticas permissivas se somam (OR), então esta abre uma porta só para esse
-- caso, sem afrouxar a política acima.
CREATE POLICY tenant_signup ON "tenant"
  FOR INSERT
  WITH CHECK (app_current_tenant_id() IS NULL);

-- ----------------------------------------------------------------------------
--  Tabela `plano` — catálogo do produto, sem RLS
-- ----------------------------------------------------------------------------
--
--  Única exceção consciente à regra "toda tabela sob RLS". `plano` não guarda
--  dado de nenhuma empresa: é a lista de planos do SaaS, igual para todo mundo,
--  e todo tenant precisa lê-la para exibir preços e limites. Não há o que
--  isolar. O teste de cobertura conhece esta exceção pelo nome.
