ALTER TABLE "plano"
  ADD COLUMN "descricao" VARCHAR(180) NOT NULL DEFAULT '',
  ADD COLUMN "nivel" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "destaque" BOOLEAN NOT NULL DEFAULT false;

UPDATE "plano"
SET
  "nome" = 'Básico',
  "preco" = 100.00,
  "descricao" = 'Para organizar CRM, agenda, clientes e financeiro com previsões gratuitas limitadas.',
  "nivel" = 1,
  "destaque" = false,
  "usuarios_inclusos" = 2,
  "preco_usuario_adicional" = 20.00,
  "limite_usuarios" = 5,
  "limite_clientes" = 500,
  "limite_envios_mensais" = 300,
  "ia_habilitada" = false,
  "limite_previsoes_ia_mensais" = 3,
  "ativo" = true
WHERE "slug" = 'essencial';

UPDATE "plano"
SET
  "nome" = 'Premium',
  "preco" = 200.00,
  "descricao" = 'Para empresas que querem mais usuários, mais clientes e previsões financeiras com IA em volume.',
  "nivel" = 2,
  "destaque" = true,
  "usuarios_inclusos" = 5,
  "preco_usuario_adicional" = 15.00,
  "limite_usuarios" = 20,
  "limite_clientes" = 3000,
  "limite_envios_mensais" = 2000,
  "ia_habilitada" = true,
  "limite_previsoes_ia_mensais" = 200,
  "ativo" = true
WHERE "slug" = 'profissional';

UPDATE "plano"
SET "ativo" = false, "destaque" = false
WHERE "slug" NOT IN ('essencial', 'profissional');

CREATE INDEX "plano_ativo_nivel_idx" ON "plano"("ativo", "nivel");
