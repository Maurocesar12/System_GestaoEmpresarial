-- CreateEnum
CREATE TYPE "marco_funil" AS ENUM ('orcamento_enviado', 'fechado');

-- AlterTable
ALTER TABLE "etapa_funil" ADD COLUMN     "marco" "marco_funil";

-- CreateIndex
CREATE UNIQUE INDEX "etapa_funil_tenant_id_marco_key" ON "etapa_funil"("tenant_id", "marco");
