CREATE TYPE "modo_execucao_ia" AS ENUM ('openai', 'demonstracao');

ALTER TABLE "plano"
  ADD COLUMN "usuarios_inclusos" INTEGER,
  ADD COLUMN "preco_usuario_adicional" DECIMAL(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN "ia_habilitada" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "limite_previsoes_ia_mensais" INTEGER;

CREATE TABLE "previsao_financeira" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "usuario_id" UUID NOT NULL,
  "meses_historico" INTEGER NOT NULL,
  "meses_projecao" INTEGER NOT NULL,
  "modo" "modo_execucao_ia" NOT NULL,
  "modelo" VARCHAR(80) NOT NULL,
  "dados_base" JSONB NOT NULL,
  "resultado" JSONB NOT NULL,
  "input_tokens" INTEGER NOT NULL DEFAULT 0,
  "output_tokens" INTEGER NOT NULL DEFAULT 0,
  "custo_estimado_usd" DECIMAL(14, 6) NOT NULL DEFAULT 0,
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "previsao_financeira_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "previsao_financeira_tenant_id_criado_em_idx"
  ON "previsao_financeira"("tenant_id", "criado_em");
CREATE INDEX "previsao_financeira_tenant_id_usuario_id_criado_em_idx"
  ON "previsao_financeira"("tenant_id", "usuario_id", "criado_em");

ALTER TABLE "previsao_financeira"
  ADD CONSTRAINT "previsao_financeira_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "previsao_financeira" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "previsao_financeira" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "previsao_financeira"
  FOR ALL
  USING (tenant_id = app_current_tenant_id())
  WITH CHECK (tenant_id = app_current_tenant_id());
