-- Saldo de reserva nunca negativo.
--
-- O serviço já impede (resgate condicional no UPDATE), mas a garantia final tem
-- de morar no banco: um caminho novo, um script ou uma corrida que escape do
-- código não pode gravar saldo negativo.
--
-- NOT VALID: vale para toda linha gravada daqui em diante sem varrer (nem
-- falhar por) dados antigos. Depois de conferir que não há saldo negativo
-- (SELECT count(*) FROM reserva_financeira WHERE valor_atual < 0), rode
--   ALTER TABLE "reserva_financeira" VALIDATE CONSTRAINT "reserva_financeira_valor_atual_check";
ALTER TABLE "reserva_financeira"
  ADD CONSTRAINT "reserva_financeira_valor_atual_check" CHECK ("valor_atual" >= 0) NOT VALID;
