-- ============================================================================
--  LGPD: anonimização de cliente e exclusão de conta cancelada (arquitetura §9.4)
-- ============================================================================

ALTER TABLE "cliente" ADD COLUMN "anonimizado_em" TIMESTAMP(3);

-- ----------------------------------------------------------------------------
--  Comprovante de exclusão
-- ----------------------------------------------------------------------------
--
--  Sem FK para `tenant`: a linha nasce na mesma transação que apaga a empresa
--  e precisa continuar existindo depois dela.

CREATE TABLE "registro_exclusao_conta" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "cancelado_em" TIMESTAMP(3) NOT NULL,
  "excluido_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "registro_exclusao_conta_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "registro_exclusao_conta_tenant_id_key"
  ON "registro_exclusao_conta"("tenant_id");

ALTER TABLE "registro_exclusao_conta" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "registro_exclusao_conta" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "registro_exclusao_conta"
  FOR ALL
  USING ("tenant_id" = app_current_tenant_id())
  WITH CHECK ("tenant_id" = app_current_tenant_id());

-- ----------------------------------------------------------------------------
--  Leitura das contas canceladas pela rotina de exclusão
-- ----------------------------------------------------------------------------
--
--  A rotina roda sem ninguém logado e precisa descobrir quais empresas
--  canceladas já passaram do prazo — o mesmo problema de partida da varredura
--  de lembretes (`20260831120000_lembrete_varredura`).
--
--  A política libera **só SELECT**, **só sem contexto** e **só empresas
--  canceladas**. Empresa ativa continua invisível sem contexto, e com contexto
--  definido sobra apenas `tenant_isolation`. A exclusão em si roda dentro do
--  contexto de cada empresa, sob a política normal.

DROP POLICY IF EXISTS tenant_expurgo ON "tenant";

CREATE POLICY tenant_expurgo ON "tenant"
  FOR SELECT
  USING (app_current_tenant_id() IS NULL AND status = 'cancelado');
