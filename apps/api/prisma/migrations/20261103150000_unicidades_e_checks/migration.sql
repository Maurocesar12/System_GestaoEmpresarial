-- Garantias no banco para o que o código já tenta garantir (etapa 6 da auditoria
-- de concorrência): o que está aqui vale mesmo se um caminho novo, um script ou
-- uma corrida escapar da checagem do serviço.

-- ─── Pró-labore ──────────────────────────────────────────────────────────────
--
-- Reparo antes das constraints. Cadastrar uma vigência com início ANTERIOR à
-- vigência aberta deixava as duas abertas (a nova nascia com `vigencia_fim`
-- nulo e a antiga não era fechada). Cada vigência passa a terminar no dia
-- anterior ao início da seguinte; sem isto, o índice parcial abaixo não criaria.
--
-- A RLS é desligada só durante o reparo: a tabela é FORCE, e sem empresa na
-- sessão um dono sem BYPASSRLS não enxergaria nenhuma linha — o reparo seria um
-- no-op silencioso e o índice falharia depois. Volta a FORCE na sequência.
ALTER TABLE "pro_labore" NO FORCE ROW LEVEL SECURITY;

UPDATE "pro_labore" AS p
   SET "vigencia_fim" = n."proximo" - 1
  FROM (
    SELECT "id",
           lead("vigencia_inicio") OVER (PARTITION BY "tenant_id" ORDER BY "vigencia_inicio") AS "proximo"
      FROM "pro_labore"
  ) AS n
 WHERE n."id" = p."id"
   AND n."proximo" IS NOT NULL
   AND (p."vigencia_fim" IS NULL OR p."vigencia_fim" >= n."proximo");

ALTER TABLE "pro_labore" FORCE ROW LEVEL SECURITY;

-- Uma vigência por data de início, por empresa (substitui o índice comum).
DROP INDEX "pro_labore_tenant_id_vigencia_inicio_idx";
CREATE UNIQUE INDEX "pro_labore_tenant_id_vigencia_inicio_key"
  ON "pro_labore"("tenant_id", "vigencia_inicio");

-- No máximo uma vigência aberta por empresa: "o valor atual" nunca é ambíguo.
-- Índice parcial: o Prisma não o modela, por isso vive só aqui.
CREATE UNIQUE INDEX "pro_labore_uma_vigencia_aberta_key"
  ON "pro_labore"("tenant_id")
  WHERE "vigencia_fim" IS NULL;

ALTER TABLE "pro_labore"
  ADD CONSTRAINT "pro_labore_vigencia_check"
  CHECK ("vigencia_fim" IS NULL OR "vigencia_fim" >= "vigencia_inicio") NOT VALID;

-- ─── Atendimento ←→ agendamento ──────────────────────────────────────────────
-- Cada agendamento executado vira um atendimento, uma vez só. Nulo no registro
-- manual (e nos antigos).
ALTER TABLE "atendimento" ADD COLUMN "agendamento_id" UUID;

CREATE UNIQUE INDEX "atendimento_agendamento_id_key" ON "atendimento"("agendamento_id");

ALTER TABLE "atendimento"
  ADD CONSTRAINT "atendimento_agendamento_id_fkey"
  FOREIGN KEY ("agendamento_id") REFERENCES "agendamento"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Estoque ─────────────────────────────────────────────────────────────────
-- Um consumo por material em cada execução. Só o consumo preenche
-- `agendamento_id`; entrada e ajuste ficam nulos, e nulo não colide na unique.
CREATE UNIQUE INDEX "movimentacao_estoque_agendamento_id_material_id_key"
  ON "movimentacao_estoque"("agendamento_id", "material_id");

-- ─── Lançamentos ─────────────────────────────────────────────────────────────
-- A mesma ocorrência de uma recorrência não vira dois lançamentos.
ALTER TABLE "lancamento_financeiro" ADD COLUMN "recorrencia_ocorrencia" INTEGER;

CREATE UNIQUE INDEX "lancamento_financeiro_recorrencia_id_recorrencia_ocorrencia_key"
  ON "lancamento_financeiro"("recorrencia_id", "recorrencia_ocorrencia");

-- Os CHECKs de parcela (`..._parcela_completa_check`, `..._parcela_faixa_check`)
-- e do cursor (`lancamento_recorrente_ocorrencias_check`) já existem desde
-- `20260930160000_recorrencia_e_parcelamento`; não se repetem aqui.
