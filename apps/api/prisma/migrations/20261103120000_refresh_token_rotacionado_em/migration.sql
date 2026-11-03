-- Distingue "token trocado por rotação" de "token revogado por logout ou por
-- derrubada de sessões". Só o primeiro tem janela de tolerância para
-- reapresentação (duas abas renovando juntas); o segundo nunca.
ALTER TABLE "refresh_token" ADD COLUMN "rotacionado_em" TIMESTAMP(3);
