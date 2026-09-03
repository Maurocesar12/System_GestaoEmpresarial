-- O login identifica o usuário apenas pelo e-mail. A restrição anterior,
-- limitada ao tenant, permitia duas contas indistinguíveis na autenticação.
-- A transação evita deixar o banco sem nenhuma restrição caso dados antigos
-- ainda precisem ser tratados antes de criar o índice global.
BEGIN;

DROP INDEX IF EXISTS "usuario_tenant_id_email_key";
CREATE UNIQUE INDEX "usuario_email_key" ON "usuario"("email");

COMMIT;
