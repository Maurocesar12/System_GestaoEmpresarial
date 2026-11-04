-- Novo status de lembrete: `enviando`.
--
-- O worker passa a reivindicar o lembrete (pendente -> enviando, atômico) antes
-- de enviar o e-mail. Cancelar só vale em `pendente`, então um cancelamento que
-- chega durante o envio recebe 409 em vez de "cancelar" um e-mail que já saiu.
--
-- Arquivo à parte de propósito: um valor de enum acrescentado numa transação
-- não pode ser usado nela, e a migration seguinte
-- (`20261103191000_lembrete_enviando`) o usa na política de RLS.
ALTER TYPE "status_lembrete" ADD VALUE IF NOT EXISTS 'enviando';
