-- ============================================================================
--  Varredura de lembretes vencidos pelo worker
--
--  O PROBLEMA
--
--  O envio automático de lembretes roda sem ninguém logado: um agendador varre
--  a tabela de tempos em tempos procurando o que já passou da hora e entrega à
--  fila. Só que essa varredura precisa enxergar **todas** as empresas de uma
--  vez, e é exatamente isso que a política de isolamento impede — sem
--  `app.current_tenant_id` definido, `tenant_id = app_current_tenant_id()` é
--  sempre falso e nenhuma linha volta.
--
--  Não dá para simplesmente percorrer empresa por empresa: a tabela `tenant`
--  também está sob RLS, e sem contexto ela não lista ninguém. É um problema de
--  partida parecido com o do login (ver `20260813100000_rls_login`).
--
--  A SOLUÇÃO
--
--  Uma política adicional que libera **apenas SELECT**, **apenas quando não há
--  contexto de tenant** e **apenas nas linhas ainda pendentes**.
--
--  O trabalho de verdade continua isolado: a varredura lê só `id` e
--  `tenant_id`, e quem envia é o worker, que define o contexto a partir do
--  `tenant_id` do job antes de tocar em qualquer dado — inclusive para
--  carregar o cliente e para gravar o resultado.
--
--  O QUE ISSO CUSTA, E POR QUE É ACEITÁVEL
--
--  Enquanto não há tenant no contexto, as linhas de lembrete pendente ficam
--  legíveis. O alcance disso:
--
--  - Não expõe dado pessoal. A linha guarda `cliente_id`, canal, status e
--    datas. Nome, e-mail e telefone vivem na tabela `cliente`, que segue sob
--    isolamento integral — o `cliente_id` sozinho não leva a lugar nenhum.
--  - Não vale para usuário autenticado. Com contexto definido,
--    `app_current_tenant_id() IS NULL` é falso e sobra apenas a política de
--    isolamento: ninguém logado passa a ver lembrete de outra empresa.
--  - Não alcança lembrete já resolvido. Enviados, falhados e cancelados ficam
--    de fora do `USING`, então o histórico continua invisível.
--  - Gravação segue isolada. A política é `FOR SELECT`; marcar um lembrete
--    como enviado ou falhado continua exigindo contexto.
--
--  A alternativa seria a varredura usar a conexão administrativa, que tem
--  BYPASSRLS. Seria menos código, mas colocaria dentro do worker uma conexão
--  que ignora o isolamento inteiro — qualquer bug ali cruzaria empresas, em vez
--  de esbarrar no banco. A política estreita mantém o worker preso às mesmas
--  regras de todo mundo.
-- ============================================================================

-- ----------------------------------------------------------------------------
--  Índice da varredura global
-- ----------------------------------------------------------------------------
--
--  Os índices existentes começam por `tenant_id`, o que serve às consultas da
--  aplicação (que sempre sabem a empresa) mas não a esta, que justamente não
--  sabe. Sem este índice, cada passagem do agendador varreria a tabela inteira.

CREATE INDEX "lembrete_follow_up_status_data_envio_idx"
  ON "lembrete_follow_up" ("status", "data_envio");

-- ----------------------------------------------------------------------------
--  Política de leitura sem contexto, restrita a pendentes
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS lembrete_varredura ON "lembrete_follow_up";

CREATE POLICY lembrete_varredura ON "lembrete_follow_up"
  FOR SELECT
  USING (app_current_tenant_id() IS NULL AND status = 'pendente');
