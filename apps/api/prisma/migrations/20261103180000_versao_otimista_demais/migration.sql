-- Controle otimista (cabeçalho If-Match) nos demais cadastros editáveis por
-- formulário. Continuação de `20261103170000_versao_otimista` (cliente,
-- lançamento e serviço).
--
-- ADD COLUMN com DEFAULT constante não reescreve a tabela (PostgreSQL 11+);
-- os registros existentes nascem na versão 1.
ALTER TABLE "orcamento" ADD COLUMN "versao" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "agendamento" ADD COLUMN "versao" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "material" ADD COLUMN "versao" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "reserva_financeira" ADD COLUMN "versao" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "usuario" ADD COLUMN "versao" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "etapa_funil" ADD COLUMN "versao" INTEGER NOT NULL DEFAULT 1;
