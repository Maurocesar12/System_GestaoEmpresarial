-- DropIndex
DROP INDEX "log_auditoria_tenant_id_acao_criado_em_idx";

-- DropIndex
DROP INDEX "log_auditoria_tenant_id_entidade_criado_em_idx";

-- AlterTable
ALTER TABLE "anexo_lancamento" ALTER COLUMN "id" DROP DEFAULT;
