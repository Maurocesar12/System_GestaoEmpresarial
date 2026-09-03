-- Permissões personalizadas por funcionário e convites de equipe.
ALTER TABLE "usuario"
  ADD COLUMN "permissoes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "permissoes_personalizadas" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "convite_equipe" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "nome" VARCHAR(120) NOT NULL,
  "email" VARCHAR(180) NOT NULL,
  "papel" "papel_usuario" NOT NULL,
  "permissoes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "token_hash" VARCHAR(64) NOT NULL,
  "expira_em" TIMESTAMP(3) NOT NULL,
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "convite_equipe_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "usuario_tenant_id_criado_em_idx" ON "usuario"("tenant_id", "criado_em");
CREATE UNIQUE INDEX "convite_equipe_token_hash_key" ON "convite_equipe"("token_hash");
CREATE UNIQUE INDEX "convite_equipe_tenant_id_email_key" ON "convite_equipe"("tenant_id", "email");
CREATE INDEX "convite_equipe_tenant_id_expira_em_idx" ON "convite_equipe"("tenant_id", "expira_em");

ALTER TABLE "convite_equipe"
  ADD CONSTRAINT "convite_equipe_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "convite_equipe" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "convite_equipe" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "convite_equipe"
  FOR ALL
  USING (tenant_id = app_current_tenant_id())
  WITH CHECK (tenant_id = app_current_tenant_id());
