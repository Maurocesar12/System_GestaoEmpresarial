ALTER TABLE "log_auditoria"
  ADD COLUMN "resumo" TEXT;

CREATE INDEX "log_auditoria_tenant_id_entidade_criado_em_idx"
  ON "log_auditoria"("tenant_id", "entidade", "criado_em");

CREATE INDEX "log_auditoria_tenant_id_acao_criado_em_idx"
  ON "log_auditoria"("tenant_id", "acao", "criado_em");
