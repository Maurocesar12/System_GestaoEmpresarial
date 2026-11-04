-- Dinheiro com o sinal certo, garantido pelo banco.
--
-- A API já recusa (schemas `dinheiroPositivoSchema` e `dinheiroNaoNegativoSchema`
-- do shared-types), mas qualquer requisição pode ser montada à mão, e um
-- script ou um caminho novo pode escapar do código. Um lançamento de -5.000
-- inverteria o fluxo de caixa; um preço ou custo negativo, a margem.
--
-- - Lançamento: estritamente positivo. A direção (entrada/saída) vem do `tipo`.
-- - Orçamento, serviço, pró-labore, custo de estoque: zero vale, negativo não.
--
-- NOT VALID: vale para toda linha gravada daqui em diante sem varrer (nem
-- falhar por) dados antigos. Para conferir os antigos:
--   SELECT count(*) FROM lancamento_financeiro WHERE valor <= 0;
--   SELECT count(*) FROM orcamento WHERE valor < 0;
--   SELECT count(*) FROM servico WHERE custo_base < 0 OR preco_padrao < 0;
--   SELECT count(*) FROM pro_labore WHERE valor < 0;
--   SELECT count(*) FROM movimentacao_estoque WHERE custo_unitario < 0;
-- Com tudo zerado, rode para cada uma:
--   ALTER TABLE "<tabela>" VALIDATE CONSTRAINT "<nome>";

ALTER TABLE "lancamento_financeiro"
  ADD CONSTRAINT "lancamento_financeiro_valor_check" CHECK ("valor" > 0) NOT VALID;

ALTER TABLE "orcamento"
  ADD CONSTRAINT "orcamento_valor_check" CHECK ("valor" >= 0) NOT VALID;

ALTER TABLE "servico"
  ADD CONSTRAINT "servico_custo_base_check" CHECK ("custo_base" >= 0) NOT VALID,
  ADD CONSTRAINT "servico_preco_padrao_check" CHECK ("preco_padrao" IS NULL OR "preco_padrao" >= 0) NOT VALID;

ALTER TABLE "pro_labore"
  ADD CONSTRAINT "pro_labore_valor_check" CHECK ("valor" >= 0) NOT VALID;

ALTER TABLE "movimentacao_estoque"
  ADD CONSTRAINT "movimentacao_estoque_custo_unitario_check" CHECK ("custo_unitario" >= 0) NOT VALID;
