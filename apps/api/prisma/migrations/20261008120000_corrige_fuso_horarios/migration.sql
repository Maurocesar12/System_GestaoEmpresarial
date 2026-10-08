-- Corrige o horário dos agendamentos e lembretes gravados antes da correção de fuso.
--
-- A API lia o "14:30" digitado no fuso do servidor. No Render, que roda em UTC,
-- isso gravava 14:30 UTC — 11:30 em Brasília, três horas antes do combinado.
-- A partir desta versão o horário é lido como Brasília (`common/fuso.ts`), e
-- os registros antigos recebem as três horas que faltavam para continuar
-- mostrando o horário que a pessoa digitou.
--
-- Roda uma vez só, como toda migration. Não há horário de verão a considerar:
-- o Brasil não o adota desde 2019, antes da existência destes registros.
UPDATE "agendamento" SET "data_hora" = "data_hora" + INTERVAL '3 hours';
UPDATE "lembrete_follow_up" SET "data_envio" = "data_envio" + INTERVAL '3 hours';
