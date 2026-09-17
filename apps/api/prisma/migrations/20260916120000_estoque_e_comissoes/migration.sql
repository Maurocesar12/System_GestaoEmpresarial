-- ============================================================================
--  Estoque de materiais e comissões
-- ============================================================================

CREATE TYPE "tipo_movimentacao_estoque" AS ENUM ('entrada', 'consumo', 'ajuste');
CREATE TYPE "tipo_comissao" AS ENUM ('venda', 'execucao');
CREATE TYPE "status_comissao" AS ENUM ('pendente', 'fechada');

-- ----------------------------------------------------------------------------
--  Vínculos novos em tabelas existentes
-- ----------------------------------------------------------------------------

ALTER TABLE "usuario"
  ADD COLUMN "comissao_venda_percentual" DECIMAL(5,2),
  ADD COLUMN "comissao_execucao_percentual" DECIMAL(5,2);

ALTER TABLE "orcamento" ADD COLUMN "vendedor_id" UUID;
ALTER TABLE "orcamento"
  ADD CONSTRAINT "orcamento_vendedor_id_fkey"
  FOREIGN KEY ("vendedor_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "agendamento"
  ADD COLUMN "tecnico_id" UUID,
  ADD COLUMN "orcamento_id" UUID;
ALTER TABLE "agendamento"
  ADD CONSTRAINT "agendamento_tecnico_id_fkey"
  FOREIGN KEY ("tecnico_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "agendamento"
  ADD CONSTRAINT "agendamento_orcamento_id_fkey"
  FOREIGN KEY ("orcamento_id") REFERENCES "orcamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ----------------------------------------------------------------------------
--  Materiais
-- ----------------------------------------------------------------------------

CREATE TABLE "material" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "nome" VARCHAR(120) NOT NULL,
  "unidade" VARCHAR(10) NOT NULL,
  "quantidade" DECIMAL(14,3) NOT NULL DEFAULT 0,
  "custo_medio" DECIMAL(14,4) NOT NULL DEFAULT 0,
  "estoque_minimo" DECIMAL(14,3),
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "material_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "material_custo_medio_check" CHECK ("custo_medio" >= 0)
);

CREATE UNIQUE INDEX "material_tenant_id_nome_key" ON "material"("tenant_id", "nome");
CREATE INDEX "material_tenant_id_ativo_idx" ON "material"("tenant_id", "ativo");
ALTER TABLE "material"
  ADD CONSTRAINT "material_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "servico_material" (
  "tenant_id" UUID NOT NULL,
  "servico_id" UUID NOT NULL,
  "material_id" UUID NOT NULL,
  "quantidade" DECIMAL(14,3) NOT NULL,

  CONSTRAINT "servico_material_pkey" PRIMARY KEY ("servico_id", "material_id"),
  CONSTRAINT "servico_material_quantidade_check" CHECK ("quantidade" > 0)
);

CREATE INDEX "servico_material_tenant_id_material_id_idx"
  ON "servico_material"("tenant_id", "material_id");
ALTER TABLE "servico_material"
  ADD CONSTRAINT "servico_material_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "servico_material"
  ADD CONSTRAINT "servico_material_servico_id_fkey"
  FOREIGN KEY ("servico_id") REFERENCES "servico"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "servico_material"
  ADD CONSTRAINT "servico_material_material_id_fkey"
  FOREIGN KEY ("material_id") REFERENCES "material"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "movimentacao_estoque" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "material_id" UUID NOT NULL,
  "tipo" "tipo_movimentacao_estoque" NOT NULL,
  "quantidade" DECIMAL(14,3) NOT NULL,
  "custo_unitario" DECIMAL(14,4) NOT NULL,
  "valor_total" DECIMAL(14,2) NOT NULL,
  "agendamento_id" UUID,
  "servico_id" UUID,
  "usuario_id" UUID,
  "observacao" VARCHAR(240),
  "data" DATE NOT NULL,
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "movimentacao_estoque_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "movimentacao_estoque_tenant_id_material_id_criado_em_idx"
  ON "movimentacao_estoque"("tenant_id", "material_id", "criado_em");
CREATE INDEX "movimentacao_estoque_tenant_id_tipo_data_idx"
  ON "movimentacao_estoque"("tenant_id", "tipo", "data");
CREATE INDEX "movimentacao_estoque_tenant_id_agendamento_id_idx"
  ON "movimentacao_estoque"("tenant_id", "agendamento_id");
ALTER TABLE "movimentacao_estoque"
  ADD CONSTRAINT "movimentacao_estoque_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "movimentacao_estoque"
  ADD CONSTRAINT "movimentacao_estoque_material_id_fkey"
  FOREIGN KEY ("material_id") REFERENCES "material"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "movimentacao_estoque"
  ADD CONSTRAINT "movimentacao_estoque_agendamento_id_fkey"
  FOREIGN KEY ("agendamento_id") REFERENCES "agendamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "movimentacao_estoque"
  ADD CONSTRAINT "movimentacao_estoque_servico_id_fkey"
  FOREIGN KEY ("servico_id") REFERENCES "servico"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ----------------------------------------------------------------------------
--  Comissões
-- ----------------------------------------------------------------------------

CREATE TABLE "comissao" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "usuario_id" UUID NOT NULL,
  "tipo" "tipo_comissao" NOT NULL,
  "status" "status_comissao" NOT NULL DEFAULT 'pendente',
  "orcamento_id" UUID,
  "agendamento_id" UUID,
  "servico_id" UUID,
  "base" DECIMAL(14,2) NOT NULL,
  "percentual" DECIMAL(5,2) NOT NULL,
  "valor" DECIMAL(14,2) NOT NULL,
  "competencia" DATE NOT NULL,
  "lancamento_id" UUID,
  "fechada_em" TIMESTAMP(3),
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "comissao_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "comissao_percentual_check" CHECK ("percentual" > 0 AND "percentual" <= 100),
  CONSTRAINT "comissao_valor_check" CHECK ("valor" >= 0)
);

CREATE UNIQUE INDEX "comissao_orcamento_id_key" ON "comissao"("orcamento_id");
CREATE UNIQUE INDEX "comissao_agendamento_id_key" ON "comissao"("agendamento_id");
CREATE INDEX "comissao_tenant_id_status_competencia_idx"
  ON "comissao"("tenant_id", "status", "competencia");
CREATE INDEX "comissao_tenant_id_usuario_id_competencia_idx"
  ON "comissao"("tenant_id", "usuario_id", "competencia");
CREATE INDEX "comissao_tenant_id_servico_id_competencia_idx"
  ON "comissao"("tenant_id", "servico_id", "competencia");
ALTER TABLE "comissao"
  ADD CONSTRAINT "comissao_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "comissao"
  ADD CONSTRAINT "comissao_usuario_id_fkey"
  FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "comissao"
  ADD CONSTRAINT "comissao_orcamento_id_fkey"
  FOREIGN KEY ("orcamento_id") REFERENCES "orcamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "comissao"
  ADD CONSTRAINT "comissao_agendamento_id_fkey"
  FOREIGN KEY ("agendamento_id") REFERENCES "agendamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "comissao"
  ADD CONSTRAINT "comissao_servico_id_fkey"
  FOREIGN KEY ("servico_id") REFERENCES "servico"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "comissao"
  ADD CONSTRAINT "comissao_lancamento_id_fkey"
  FOREIGN KEY ("lancamento_id") REFERENCES "lancamento_financeiro"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ----------------------------------------------------------------------------
--  Isolamento entre empresas (arquitetura §4.2) — as quatro tabelas novas
-- ----------------------------------------------------------------------------

DO $$
DECLARE
  tabela text;
BEGIN
  FOREACH tabela IN ARRAY ARRAY['material', 'servico_material', 'movimentacao_estoque', 'comissao']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tabela);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tabela);
    EXECUTE format($politica$
      CREATE POLICY tenant_isolation ON %I
        FOR ALL
        USING (tenant_id = app_current_tenant_id())
        WITH CHECK (tenant_id = app_current_tenant_id())
    $politica$, tabela);
  END LOOP;
END
$$;
