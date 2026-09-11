-- Data do último pagamento confirmado. Cada pagamento vale um mês de acesso,
-- contado a partir deste dia (regra em `calcularAcesso`).
ALTER TABLE "tenant" ADD COLUMN "ultimo_pagamento_em" DATE;

-- Empresas que já estão ativas hoje não podem ser barradas pela regra nova ao
-- subir esta versão: sem uma data de pagamento, o cálculo cairia no fim do
-- teste (provavelmente vencido) e elas perderiam o acesso de um dia para o
-- outro. A data de hoje dá a elas o mês corrente para regularizar o cadastro
-- do pagamento.
UPDATE "tenant"
SET "ultimo_pagamento_em" = CURRENT_DATE
WHERE "status" = 'ativo' AND "ultimo_pagamento_em" IS NULL;

-- Consulta do cronograma de cobrança: "quem vence nos próximos dias".
CREATE INDEX "tenant_ultimo_pagamento_em_idx" ON "tenant" ("ultimo_pagamento_em");
