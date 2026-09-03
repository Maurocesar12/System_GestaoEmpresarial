CREATE TYPE "tipo_campo_personalizado" AS ENUM ('texto', 'numero', 'data', 'selecao');

ALTER TABLE "tenant" ADD COLUMN "email" VARCHAR(180), ADD COLUMN "telefone" VARCHAR(20);
ALTER TABLE "cliente" ADD COLUMN "campos_personalizados" JSONB NOT NULL DEFAULT '{}';

CREATE TABLE "campo_personalizado" (
  "id" UUID NOT NULL, "tenant_id" UUID NOT NULL, "nome" VARCHAR(80) NOT NULL,
  "tipo" "tipo_campo_personalizado" NOT NULL DEFAULT 'texto', "obrigatorio" BOOLEAN NOT NULL DEFAULT false,
  "opcoes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[], "ordem" INTEGER NOT NULL DEFAULT 0,
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "campo_personalizado_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "etiqueta" (
  "id" UUID NOT NULL, "tenant_id" UUID NOT NULL, "nome" VARCHAR(40) NOT NULL,
  "cor" VARCHAR(7) NOT NULL, "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "etiqueta_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "cliente_etiqueta" (
  "tenant_id" UUID NOT NULL, "cliente_id" UUID NOT NULL, "etiqueta_id" UUID NOT NULL,
  CONSTRAINT "cliente_etiqueta_pkey" PRIMARY KEY ("cliente_id", "etiqueta_id")
);

CREATE UNIQUE INDEX "campo_personalizado_tenant_id_nome_key" ON "campo_personalizado"("tenant_id", "nome");
CREATE INDEX "campo_personalizado_tenant_id_ordem_idx" ON "campo_personalizado"("tenant_id", "ordem");
CREATE UNIQUE INDEX "etiqueta_tenant_id_nome_key" ON "etiqueta"("tenant_id", "nome");
CREATE INDEX "cliente_etiqueta_tenant_id_etiqueta_id_idx" ON "cliente_etiqueta"("tenant_id", "etiqueta_id");

ALTER TABLE "campo_personalizado" ADD CONSTRAINT "campo_personalizado_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "etiqueta" ADD CONSTRAINT "etiqueta_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cliente_etiqueta" ADD CONSTRAINT "cliente_etiqueta_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cliente_etiqueta" ADD CONSTRAINT "cliente_etiqueta_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cliente_etiqueta" ADD CONSTRAINT "cliente_etiqueta_etiqueta_id_fkey" FOREIGN KEY ("etiqueta_id") REFERENCES "etiqueta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DO $$ DECLARE tabela text; BEGIN
  FOREACH tabela IN ARRAY ARRAY['campo_personalizado', 'etiqueta', 'cliente_etiqueta'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tabela);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tabela);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I FOR ALL USING (tenant_id = app_current_tenant_id()) WITH CHECK (tenant_id = app_current_tenant_id())', tabela);
  END LOOP;
END $$;
