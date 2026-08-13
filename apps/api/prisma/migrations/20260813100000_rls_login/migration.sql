-- ============================================================================
--  Exceção de RLS para o login
--
--  O PROBLEMA
--
--  Autenticar tem um paradoxo: para achar o usuário é preciso saber a empresa,
--  e a empresa só se descobre depois de achar o usuário. Quando alguém digita
--  e-mail e senha, o servidor ainda não tem tenant nenhum no contexto — e a
--  política de isolamento, corretamente, não devolve linha alguma nessa
--  situação.
--
--  Sem esta migration, o login sempre falha com "e-mail ou senha incorretos",
--  mesmo com a senha certa, e o cadastro aceita e-mails repetidos por não
--  enxergar os já existentes.
--
--  A SOLUÇÃO
--
--  Uma política adicional que libera **apenas SELECT**, **apenas quando não há
--  contexto de tenant**, e **apenas na tabela `usuario`**.
--
--  O QUE ISSO CUSTA, E POR QUE É ACEITÁVEL
--
--  Enquanto não há tenant no contexto, a tabela `usuario` fica legível. Vale
--  entender bem o alcance disso:
--
--  - Não afeta nenhum dado de negócio. Clientes, orçamentos, lançamentos
--    financeiros — tudo continua sob isolamento integral. A exceção é só na
--    tabela de identidade.
--  - Não expõe senha. A coluna guarda hash Argon2id, que não é reversível.
--  - Não vale para usuário autenticado. Assim que existe contexto,
--    `app_current_tenant_id() IS NULL` é falso e sobra apenas a política de
--    isolamento — um usuário logado continua sem enxergar quem trabalha em
--    outra empresa. Há teste cobrindo isso.
--  - Gravação segue isolada. A política é `FOR SELECT`; criar ou alterar
--    usuário continua exigindo contexto.
--
--  A alternativa seria uma tabela auxiliar fora da RLS mapeando e-mail para
--  empresa, mantida por trigger. Protege um pouco mais, ao custo de dado
--  duplicado que pode dessincronizar. Para o tamanho do risco aqui, a política
--  direta é a troca melhor.
-- ============================================================================

DROP POLICY IF EXISTS usuario_login ON "usuario";

CREATE POLICY usuario_login ON "usuario"
  FOR SELECT
  USING (app_current_tenant_id() IS NULL);
