CREATE TABLE "anexo_lancamento" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "tenant_id" UUID NOT NULL,
  "lancamento_id" UUID NOT NULL,
  "nome" VARCHAR(180) NOT NULL,
  "mime_type" VARCHAR(120) NOT NULL,
  "tamanho_bytes" INTEGER NOT NULL,
  "conteudo" TEXT NOT NULL,
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "anexo_lancamento_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "anexo_lancamento_tamanho_bytes_check"
    CHECK ("tamanho_bytes" > 0 AND "tamanho_bytes" <= 2097152),
  CONSTRAINT "anexo_lancamento_mime_type_check"
    CHECK ("mime_type" IN ('application/pdf', 'image/png', 'image/jpeg', 'image/webp')),
  CONSTRAINT "anexo_lancamento_conteudo_check"
    CHECK ("conteudo" ~ '^data:(application/pdf|image/png|image/jpeg|image/webp);base64,')
);

ALTER TABLE "anexo_lancamento"
  ADD CONSTRAINT "anexo_lancamento_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "anexo_lancamento"
  ADD CONSTRAINT "anexo_lancamento_lancamento_id_fkey"
  FOREIGN KEY ("lancamento_id") REFERENCES "lancamento_financeiro"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "anexo_lancamento_tenant_id_lancamento_id_idx"
  ON "anexo_lancamento"("tenant_id", "lancamento_id");

ALTER TABLE "anexo_lancamento" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "anexo_lancamento" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "anexo_lancamento"
  FOR ALL
  USING ("tenant_id" = app_current_tenant_id())
  WITH CHECK ("tenant_id" = app_current_tenant_id());
