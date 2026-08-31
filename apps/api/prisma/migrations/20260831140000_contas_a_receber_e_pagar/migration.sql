-- ============================================================================
--  Contas a receber e a pagar
--
--  O QUE MUDA
--
--  Até aqui o financeiro era caixa puro: todo lançamento representava dinheiro
--  que já tinha se movido, e `data` servia ao mesmo tempo de competência e de
--  data de caixa. Isso responde "quanto entrou no mês", mas não responde
--  "quanto tenho a receber" nem "o que já venceu" — que é o que abre o dia de
--  quem administra uma PME.
--
--  Duas colunas separam os dois conceitos:
--
--    data       competência — a que dia o fato pertence (serviço prestado)
--    vencimento quando o valor é devido; nulo em lançamento à vista
--    pago_em    quando o dinheiro efetivamente andou; nulo enquanto em aberto
--
--  A situação (pago / a vencer / atrasado) é **derivada** dessas colunas, e não
--  gravada. "Atrasado" depende de que dia é hoje: uma coluna com esse valor
--  estaria errada na manhã seguinte e exigiria um job varrendo a tabela toda
--  madrugada só para manter texto atualizado.
--
--  O BACKFILL, E POR QUE ELE É OBRIGATÓRIO
--
--  A partir desta migration, fluxo de caixa e margem somam por `pago_em`, não
--  mais por `data` — senão uma conta a receber entraria no saldo do caixa como
--  se o dinheiro já estivesse na conta.
--
--  Só que as linhas que já existem têm `pago_em` nulo e sumiriam de todos os
--  relatórios: o histórico inteiro da empresa zeraria da noite para o dia. O
--  `UPDATE` abaixo evita isso afirmando o que sempre foi verdade nesses dados —
--  tudo que foi lançado até agora era dinheiro que já tinha se movido, na data
--  informada.
--
--  Com o backfill, nenhum número existente muda. Só os lançamentos criados
--  daqui para a frente, e deixados em aberto, ficam fora do caixa.
-- ============================================================================

ALTER TABLE "lancamento_financeiro"
  ADD COLUMN "vencimento" DATE,
  ADD COLUMN "pago_em" DATE;

-- Todo lançamento anterior a esta migration era dinheiro já movimentado.
UPDATE "lancamento_financeiro" SET "pago_em" = "data" WHERE "pago_em" IS NULL;

-- ----------------------------------------------------------------------------
--  Índices
-- ----------------------------------------------------------------------------
--
--  Os índices existentes começam por (tenant_id, data) e não servem mais aos
--  relatórios, que passaram a filtrar por `pago_em`.

CREATE INDEX "lancamento_financeiro_tenant_id_pago_em_idx"
  ON "lancamento_financeiro" ("tenant_id", "pago_em");

-- A tela de contas em aberto: o que não foi pago, na ordem do vencimento.
CREATE INDEX "lancamento_financeiro_tenant_id_pago_em_vencimento_idx"
  ON "lancamento_financeiro" ("tenant_id", "pago_em", "vencimento");
