-- O 2FA deixou de ter códigos de recuperação: quem perde o celular pede ao
-- administrador para redefinir. A coluna sai junto, para que nenhum código
-- já emitido continue existindo no banco.
ALTER TABLE "usuario" DROP COLUMN "dois_fatores_recuperacao";
