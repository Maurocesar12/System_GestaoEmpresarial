-- ============================================================================
--  Chave do formulário embedável (arquitetura §8.3)
--
--  O formulário que o assinante cola no próprio site precisa gravar um lead
--  sem ninguém estar logado. Quem autoriza essa gravação é esta chave.
--
--  FORMATO: `<tenantId>.<segredo>`
--
--  O prefixo com o id da empresa é o mesmo desenho do refresh token, e pelo
--  mesmo motivo: a tabela `tenant` está sob RLS, então achar a empresa a
--  partir de uma chave exigiria lê-la sem contexto — e o contexto é justamente
--  o que estamos tentando descobrir. Com o id dentro da própria chave, o
--  servidor separa o prefixo, estabelece o contexto e confere o segredo
--  normalmente. Nenhuma política precisa ser afrouxada.
--
--  A chave fica à vista no HTML do site do assinante, e isso é esperado: ela
--  **só permite criar lead**. Não lê cliente, não lê financeiro, não devolve
--  nada além de "recebido". Trocar o prefixo por outro id só faz o segredo não
--  bater dentro daquela outra empresa.
-- ============================================================================

ALTER TABLE "tenant" ADD COLUMN "chave_marketing" VARCHAR(120);

-- Único para que duas empresas nunca compartilhem a mesma chave, e porque a
-- busca do endpoint público passa por aqui a cada envio do formulário.
CREATE UNIQUE INDEX "tenant_chave_marketing_key" ON "tenant"("chave_marketing");
