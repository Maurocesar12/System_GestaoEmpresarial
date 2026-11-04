-- Lembrete `enviando`: início do envio e recuperação de envio travado.
--
-- `iniciado_em` marca quando o worker reivindicou o lembrete. Se o processo
-- morrer entre a reivindicação e o desfecho, o lembrete fica `enviando` para
-- sempre; a varredura passa a procurar os `enviando` antigos (o prazo é do
-- agendador) e os devolve à fila.
ALTER TABLE "lembrete_follow_up" ADD COLUMN "iniciado_em" TIMESTAMP(3);

-- A varredura (sem contexto de empresa, declarada como 'lembretes') precisa
-- enxergar também os `enviando`, para achar os travados. O alcance continua
-- estreito: só leitura, só com a declaração, e a linha guarda ids, canal,
-- status e datas — nada de dado pessoal. Enviados, falhados e cancelados
-- seguem fora.
DROP POLICY IF EXISTS lembrete_varredura ON "lembrete_follow_up";

CREATE POLICY lembrete_varredura ON "lembrete_follow_up"
  FOR SELECT
  USING (
    app_current_tenant_id() IS NULL
    AND current_setting('app.varredura', true) = 'lembretes'
    AND status IN ('pendente', 'enviando')
  );
