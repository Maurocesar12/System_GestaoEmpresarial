-- Verificação em duas etapas obrigatória (app autenticador, TOTP).
ALTER TABLE "usuario"
  ADD COLUMN "dois_fatores_segredo" VARCHAR(255),
  ADD COLUMN "dois_fatores_ativado_em" TIMESTAMP(3),
  ADD COLUMN "dois_fatores_ultimo_passo" INTEGER,
  ADD COLUMN "dois_fatores_recuperacao" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "dois_fatores_falhas" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "dois_fatores_bloqueado_ate" TIMESTAMP(3);

-- Encerra as sessões abertas. Elas nasceram só com senha; sem isto, quem já
-- estava logado seguiria renovando a sessão por até 7 dias sem nunca passar
-- pelo segundo fator. Apagar, e não revogar: um token revogado reapresentado é
-- tratado como roubo, e encheria o log de alarmes falsos no dia do deploy.
DELETE FROM "refresh_token";
