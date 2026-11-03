-- Idempotência de pedidos (cabeçalho Idempotency-Key).
CREATE TABLE "chave_idempotencia" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "usuario_id" UUID NOT NULL,
  "chave" VARCHAR(128) NOT NULL,
  "impressao" VARCHAR(64) NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'em_andamento',
  "resposta" JSONB,
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expira_em" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "chave_idempotencia_pkey" PRIMARY KEY ("id")
);

-- É a unique que decide quem "ganha" a chave quando dois pedidos chegam juntos.
CREATE UNIQUE INDEX "chave_idempotencia_tenant_id_usuario_id_chave_key"
  ON "chave_idempotencia"("tenant_id", "usuario_id", "chave");
CREATE INDEX "chave_idempotencia_tenant_id_expira_em_idx"
  ON "chave_idempotencia"("tenant_id", "expira_em");

ALTER TABLE "chave_idempotencia"
  ADD CONSTRAINT "chave_idempotencia_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "chave_idempotencia" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chave_idempotencia" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "chave_idempotencia"
  FOR ALL
  USING (tenant_id = app_current_tenant_id())
  WITH CHECK (tenant_id = app_current_tenant_id());
