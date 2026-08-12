-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "papel_usuario" AS ENUM ('admin', 'financeiro', 'atendente', 'tecnico');

-- CreateEnum
CREATE TYPE "status_tenant" AS ENUM ('trial', 'ativo', 'suspenso', 'cancelado');

-- CreateEnum
CREATE TYPE "status_orcamento" AS ENUM ('aberto', 'aprovado', 'recusado');

-- CreateEnum
CREATE TYPE "status_agendamento" AS ENUM ('agendado', 'confirmado', 'executado', 'cancelado');

-- CreateEnum
CREATE TYPE "canal_lembrete" AS ENUM ('email', 'whatsapp');

-- CreateEnum
CREATE TYPE "status_lembrete" AS ENUM ('pendente', 'enviado', 'falhou', 'cancelado');

-- CreateEnum
CREATE TYPE "tipo_lancamento" AS ENUM ('entrada', 'saida');

-- CreateEnum
CREATE TYPE "natureza_lancamento" AS ENUM ('pessoal', 'empresa');

-- CreateEnum
CREATE TYPE "tipo_custo" AS ENUM ('fixo', 'variavel');

-- CreateTable
CREATE TABLE "plano" (
    "id" UUID NOT NULL,
    "nome" VARCHAR(60) NOT NULL,
    "slug" VARCHAR(60) NOT NULL,
    "preco" DECIMAL(14,2) NOT NULL,
    "limite_usuarios" INTEGER,
    "limite_clientes" INTEGER,
    "limite_envios_mensais" INTEGER,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plano_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant" (
    "id" UUID NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "cnpj" VARCHAR(14),
    "plano_id" UUID NOT NULL,
    "status" "status_tenant" NOT NULL DEFAULT 'trial',
    "trial_termina_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,
    "cancelado_em" TIMESTAMP(3),

    CONSTRAINT "tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assinatura" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "asaas_id" VARCHAR(60) NOT NULL,
    "status" VARCHAR(30) NOT NULL,
    "proximo_vencimento" DATE,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assinatura_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "email" VARCHAR(180) NOT NULL,
    "senha_hash" VARCHAR(255) NOT NULL,
    "papel" "papel_usuario" NOT NULL DEFAULT 'atendente',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ultimo_login_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_token" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "expira_em" TIMESTAMP(3) NOT NULL,
    "revogado_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cliente" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "email" VARCHAR(180),
    "telefone" VARCHAR(20),
    "documento" VARCHAR(14),
    "observacoes" TEXT,
    "origem" VARCHAR(60),
    "utm_source" VARCHAR(120),
    "utm_medium" VARCHAR(120),
    "utm_campaign" VARCHAR(120),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atendimento" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "cliente_id" UUID NOT NULL,
    "descricao" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "atendimento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "servico" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "categoria" VARCHAR(60),
    "custo_base" DECIMAL(14,2) NOT NULL,
    "preco_padrao" DECIMAL(14,2),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "servico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orcamento" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "cliente_id" UUID NOT NULL,
    "servico_id" UUID,
    "descricao" TEXT,
    "valor" DECIMAL(14,2) NOT NULL,
    "status" "status_orcamento" NOT NULL DEFAULT 'aberto',
    "valido_ate" DATE,
    "respondido_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orcamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agendamento" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "cliente_id" UUID NOT NULL,
    "servico_id" UUID,
    "data_hora" TIMESTAMP(3) NOT NULL,
    "observacoes" TEXT,
    "status" "status_agendamento" NOT NULL DEFAULT 'agendado',
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agendamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "etapa_funil" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "nome" VARCHAR(60) NOT NULL,
    "ordem" INTEGER NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "etapa_funil_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cliente_funil" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "cliente_id" UUID NOT NULL,
    "etapa_id" UUID NOT NULL,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cliente_funil_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lembrete_follow_up" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "cliente_id" UUID NOT NULL,
    "canal" "canal_lembrete" NOT NULL,
    "status" "status_lembrete" NOT NULL DEFAULT 'pendente',
    "data_envio" TIMESTAMP(3) NOT NULL,
    "enviado_em" TIMESTAMP(3),
    "erro" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lembrete_follow_up_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categoria_financeira" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "nome" VARCHAR(60) NOT NULL,
    "tipo_custo" "tipo_custo" NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categoria_financeira_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lancamento_financeiro" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "tipo" "tipo_lancamento" NOT NULL,
    "natureza" "natureza_lancamento" NOT NULL DEFAULT 'empresa',
    "descricao" VARCHAR(180) NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL,
    "data" DATE NOT NULL,
    "categoria_id" UUID,
    "servico_id" UUID,
    "cliente_id" UUID,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lancamento_financeiro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pro_labore" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL,
    "vigencia_inicio" DATE NOT NULL,
    "vigencia_fim" DATE,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pro_labore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reserva_financeira" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "nome" VARCHAR(60) NOT NULL,
    "valor_atual" DECIMAL(14,2) NOT NULL,
    "meta" DECIMAL(14,2),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reserva_financeira_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "log_auditoria" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "usuario_id" UUID,
    "entidade" VARCHAR(60) NOT NULL,
    "entidade_id" UUID NOT NULL,
    "acao" VARCHAR(20) NOT NULL,
    "antes" JSONB,
    "depois" JSONB,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "log_auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plano_slug_key" ON "plano"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_cnpj_key" ON "tenant"("cnpj");

-- CreateIndex
CREATE INDEX "tenant_status_idx" ON "tenant"("status");

-- CreateIndex
CREATE UNIQUE INDEX "assinatura_tenant_id_key" ON "assinatura"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "assinatura_asaas_id_key" ON "assinatura"("asaas_id");

-- CreateIndex
CREATE INDEX "usuario_tenant_id_ativo_idx" ON "usuario"("tenant_id", "ativo");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_tenant_id_email_key" ON "usuario"("tenant_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_token_token_hash_key" ON "refresh_token"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_token_tenant_id_usuario_id_expira_em_idx" ON "refresh_token"("tenant_id", "usuario_id", "expira_em");

-- CreateIndex
CREATE INDEX "cliente_tenant_id_nome_idx" ON "cliente"("tenant_id", "nome");

-- CreateIndex
CREATE INDEX "cliente_tenant_id_criado_em_idx" ON "cliente"("tenant_id", "criado_em");

-- CreateIndex
CREATE INDEX "cliente_tenant_id_origem_idx" ON "cliente"("tenant_id", "origem");

-- CreateIndex
CREATE INDEX "atendimento_tenant_id_cliente_id_data_idx" ON "atendimento"("tenant_id", "cliente_id", "data");

-- CreateIndex
CREATE INDEX "servico_tenant_id_ativo_idx" ON "servico"("tenant_id", "ativo");

-- CreateIndex
CREATE UNIQUE INDEX "servico_tenant_id_nome_key" ON "servico"("tenant_id", "nome");

-- CreateIndex
CREATE INDEX "orcamento_tenant_id_status_idx" ON "orcamento"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "orcamento_tenant_id_cliente_id_idx" ON "orcamento"("tenant_id", "cliente_id");

-- CreateIndex
CREATE INDEX "agendamento_tenant_id_data_hora_idx" ON "agendamento"("tenant_id", "data_hora");

-- CreateIndex
CREATE INDEX "agendamento_tenant_id_status_idx" ON "agendamento"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "etapa_funil_tenant_id_ordem_key" ON "etapa_funil"("tenant_id", "ordem");

-- CreateIndex
CREATE UNIQUE INDEX "cliente_funil_cliente_id_key" ON "cliente_funil"("cliente_id");

-- CreateIndex
CREATE INDEX "cliente_funil_tenant_id_etapa_id_idx" ON "cliente_funil"("tenant_id", "etapa_id");

-- CreateIndex
CREATE INDEX "lembrete_follow_up_tenant_id_status_data_envio_idx" ON "lembrete_follow_up"("tenant_id", "status", "data_envio");

-- CreateIndex
CREATE INDEX "lembrete_follow_up_tenant_id_cliente_id_idx" ON "lembrete_follow_up"("tenant_id", "cliente_id");

-- CreateIndex
CREATE UNIQUE INDEX "categoria_financeira_tenant_id_nome_key" ON "categoria_financeira"("tenant_id", "nome");

-- CreateIndex
CREATE INDEX "lancamento_financeiro_tenant_id_data_idx" ON "lancamento_financeiro"("tenant_id", "data");

-- CreateIndex
CREATE INDEX "lancamento_financeiro_tenant_id_tipo_data_idx" ON "lancamento_financeiro"("tenant_id", "tipo", "data");

-- CreateIndex
CREATE INDEX "lancamento_financeiro_tenant_id_servico_id_idx" ON "lancamento_financeiro"("tenant_id", "servico_id");

-- CreateIndex
CREATE INDEX "pro_labore_tenant_id_vigencia_inicio_idx" ON "pro_labore"("tenant_id", "vigencia_inicio");

-- CreateIndex
CREATE UNIQUE INDEX "reserva_financeira_tenant_id_nome_key" ON "reserva_financeira"("tenant_id", "nome");

-- CreateIndex
CREATE INDEX "log_auditoria_tenant_id_entidade_entidade_id_idx" ON "log_auditoria"("tenant_id", "entidade", "entidade_id");

-- CreateIndex
CREATE INDEX "log_auditoria_tenant_id_criado_em_idx" ON "log_auditoria"("tenant_id", "criado_em");

-- AddForeignKey
ALTER TABLE "tenant" ADD CONSTRAINT "tenant_plano_id_fkey" FOREIGN KEY ("plano_id") REFERENCES "plano"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assinatura" ADD CONSTRAINT "assinatura_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_token" ADD CONSTRAINT "refresh_token_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_token" ADD CONSTRAINT "refresh_token_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cliente" ADD CONSTRAINT "cliente_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atendimento" ADD CONSTRAINT "atendimento_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atendimento" ADD CONSTRAINT "atendimento_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servico" ADD CONSTRAINT "servico_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orcamento" ADD CONSTRAINT "orcamento_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orcamento" ADD CONSTRAINT "orcamento_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orcamento" ADD CONSTRAINT "orcamento_servico_id_fkey" FOREIGN KEY ("servico_id") REFERENCES "servico"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendamento" ADD CONSTRAINT "agendamento_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendamento" ADD CONSTRAINT "agendamento_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendamento" ADD CONSTRAINT "agendamento_servico_id_fkey" FOREIGN KEY ("servico_id") REFERENCES "servico"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "etapa_funil" ADD CONSTRAINT "etapa_funil_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cliente_funil" ADD CONSTRAINT "cliente_funil_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cliente_funil" ADD CONSTRAINT "cliente_funil_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cliente_funil" ADD CONSTRAINT "cliente_funil_etapa_id_fkey" FOREIGN KEY ("etapa_id") REFERENCES "etapa_funil"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lembrete_follow_up" ADD CONSTRAINT "lembrete_follow_up_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lembrete_follow_up" ADD CONSTRAINT "lembrete_follow_up_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categoria_financeira" ADD CONSTRAINT "categoria_financeira_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamento_financeiro" ADD CONSTRAINT "lancamento_financeiro_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamento_financeiro" ADD CONSTRAINT "lancamento_financeiro_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categoria_financeira"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamento_financeiro" ADD CONSTRAINT "lancamento_financeiro_servico_id_fkey" FOREIGN KEY ("servico_id") REFERENCES "servico"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamento_financeiro" ADD CONSTRAINT "lancamento_financeiro_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_labore" ADD CONSTRAINT "pro_labore_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reserva_financeira" ADD CONSTRAINT "reserva_financeira_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "log_auditoria" ADD CONSTRAINT "log_auditoria_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
