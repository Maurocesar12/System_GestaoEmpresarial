-- Controle otimista de concorrência (cabeçalho If-Match): cada registro editável
-- por formulário ganha uma versão que sobe a cada alteração. A edição que chega
-- com a versão antiga perde com 409 em vez de sobrescrever a de outra pessoa.
--
-- ADD COLUMN com DEFAULT constante não reescreve a tabela (PostgreSQL 11+);
-- os registros existentes nascem na versão 1.
ALTER TABLE "cliente" ADD COLUMN "versao" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "lancamento_financeiro" ADD COLUMN "versao" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "servico" ADD COLUMN "versao" INTEGER NOT NULL DEFAULT 1;
