-- Alinha `lancamento_recorrente` ao schema: sem defaults de banco em `id` e
-- `atualizado_em`.
--
-- A migration `20260930160000_recorrencia_e_parcelamento` criou a tabela com
-- `id DEFAULT uuidv7()` e `atualizado_em DEFAULT CURRENT_TIMESTAMP`, que o
-- schema não declara: o Prisma gera o id (`uuid(7)`) e preenche `@updatedAt`
-- no cliente, como em todas as outras tabelas. A diferença fazia o
-- `migrate dev` propor este mesmo DROP DEFAULT a cada geração.
--
-- Nada depende dos defaults: o serviço e o agendador passam o `id`, e o
-- Prisma grava `atualizado_em`. Tirar `uuidv7()` também remove a única função
-- que só existe no PostgreSQL 18 de dentro do esquema de tabelas.
ALTER TABLE "lancamento_recorrente"
  ALTER COLUMN "id" DROP DEFAULT,
  ALTER COLUMN "atualizado_em" DROP DEFAULT;
