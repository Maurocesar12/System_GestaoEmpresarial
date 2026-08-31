# Gestão Empresarial

SaaS multi-tenant de gestão para pequenas e médias empresas de serviço. O
produto une CRM e financeiro no mesmo sistema para acompanhar clientes,
orçamentos, agenda, follow-ups, entradas, saídas e margem por serviço.

O diferencial do projeto é ligar operação e dinheiro: um serviço vendido,
agendado, executado e lançado no financeiro pode alimentar relatórios de caixa e
margem sem depender de planilhas paralelas.

## Sumário

- [Stack](#stack)
- [Funcionalidades](#funcionalidades)
- [Arquitetura](#arquitetura)
- [Pré-requisitos](#pré-requisitos)
- [Como Rodar Localmente](#como-rodar-localmente)
- [Comandos Úteis](#comandos-úteis)
- [Banco e Multi-tenancy](#banco-e-multi-tenancy)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Variáveis de Ambiente](#variáveis-de-ambiente)
- [Testes](#testes)
- [Deploy](#deploy)
- [Documentação](#documentação)

## Stack

| Camada           | Tecnologia                                          |
| ---------------- | --------------------------------------------------- |
| Monorepo         | pnpm workspaces + Turborepo                         |
| Backend          | NestJS, TypeScript, Prisma                          |
| Frontend         | Next.js 16 App Router, React 19, Tailwind CSS       |
| Banco            | PostgreSQL com Row-Level Security                   |
| Validação        | Zod compartilhado entre API e web                   |
| Autenticação     | JWT curto + refresh token com rotação               |
| Segurança        | Helmet, CORS restrito, rate limit, cookies httpOnly |
| UI e formulários | React Hook Form, Zod Resolver                       |
| Drag and drop    | dnd-kit                                             |
| Gráficos         | Recharts                                            |

## Funcionalidades

Já implementado:

- Cadastro e login com sessão segura.
- Onboarding self-service criando tenant, usuário admin e dados-semente.
- Isolamento multi-tenant com contexto por requisição, Prisma extension e RLS.
- Clientes, histórico de atendimentos e origem/UTM.
- Funil de vendas com etapas configuráveis e movimentação por kanban.
- Catálogo de serviços.
- Orçamentos com status e movimentação automática no funil.
- Agendamentos com máquina de estados.
- Lembretes de follow-up manuais.
- Envio automático dos lembretes por e-mail: varredura agendada, fila BullMQ e
  worker. Depende de `REDIS_URL`; sem ela os lembretes ficam pendentes.
- Financeiro com categorias, lançamentos, fluxo de caixa e margem por serviço.
- Guards por papel: `admin`, `financeiro`, `atendente`, `tecnico`.

Ainda planejado:

- Lembrete por WhatsApp utility — depende de conta aprovada na Meta. Hoje o
  worker marca esses lembretes como falhos, informando o motivo.
- Billing com Asaas, limites de plano e webhooks.
- Painel interno administrativo.
- Marketing beta e formulário embedável.

## Arquitetura

O frontend nunca acessa o banco diretamente. O fluxo principal é:

```text
Next.js Web -> API NestJS -> Prisma -> PostgreSQL + RLS
```

O projeto usa banco compartilhado com schema compartilhado. Cada tabela de
negócio possui `tenant_id`, e o isolamento entre empresas acontece em três
camadas:

| Camada           | Onde                                            | Função                                       |
| ---------------- | ----------------------------------------------- | -------------------------------------------- |
| Contexto         | `apps/api/src/infra/tenant`                     | Guarda o tenant atual em `AsyncLocalStorage` |
| Prisma extension | `apps/api/src/infra/prisma/tenant.extension.ts` | Injeta filtros e valida gravações            |
| RLS              | migrations SQL do Prisma                        | O PostgreSQL bloqueia linhas de outro tenant |

A arquitetura completa está em [docs/arquitetura.md](docs/arquitetura.md).

## Pré-requisitos

- Node.js 22, conforme [.nvmrc](.nvmrc).
- pnpm 11.
- PostgreSQL 15 ou superior.
- PowerShell para usar os scripts de banco no Windows.

Instale o pnpm, se necessário:

```bash
npm install -g pnpm
```

## Como Rodar Localmente

### 1. Instale as dependências

```bash
pnpm install
```

### 2. Crie os arquivos de ambiente

No Windows PowerShell:

```powershell
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env.local
```

Em macOS/Linux/Git Bash:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

Gere um `JWT_SECRET` seguro e coloque em `apps/api/.env`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

### 3. Prepare o PostgreSQL local

O script cria:

- Banco de desenvolvimento: `gestao_dev`.
- Banco de testes: `gestao_test`.
- Role da aplicação: `gestao_app`, sem `BYPASSRLS`.
- Role administrativo: `gestao_admin`, com `BYPASSRLS`.
- Connection strings em `apps/api/.env`.

Rode:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\setup-database.ps1
```

O script vai pedir a senha do superusuário `postgres`. Ela não é gravada.

Se você esqueceu a senha do `postgres`, existe um script auxiliar. Ele precisa
ser executado como Administrador:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\resetar-senha-postgres.ps1
```

### 4. Aplique migrations e seed

```bash
pnpm --filter @gestao/api db:migrate
pnpm --filter @gestao/api db:seed
```

O seed cria planos iniciais usados pelo onboarding.

### 5. Suba API e web

```bash
pnpm dev
```

Serviços locais:

| Serviço      | URL                          |
| ------------ | ---------------------------- |
| Web          | http://localhost:3000        |
| API          | http://localhost:3333        |
| Health check | http://localhost:3333/health |

Depois de subir, acesse `http://localhost:3000/cadastro` para criar uma empresa
e entrar no painel.

## Comandos Úteis

Todos os comandos abaixo rodam na raiz do repositório.

| Comando             | O que faz                              |
| ------------------- | -------------------------------------- |
| `pnpm dev`          | Sobe API e web em modo desenvolvimento |
| `pnpm build`        | Gera build de produção dos pacotes     |
| `pnpm lint`         | Executa ESLint                         |
| `pnpm typecheck`    | Executa TypeScript sem emitir arquivos |
| `pnpm test`         | Roda testes unitários                  |
| `pnpm format`       | Formata arquivos com Prettier          |
| `pnpm format:check` | Verifica formatação                    |

Comandos por pacote:

```bash
pnpm --filter @gestao/api dev
pnpm --filter @gestao/web dev
pnpm --filter @gestao/api db:migrate
pnpm --filter @gestao/api db:seed
pnpm --filter @gestao/api test:db
```

## Banco e Multi-tenancy

O projeto foi pensado para SaaS desde a primeira migration. Todas as tabelas de
negócio são isoladas por tenant e protegidas por RLS.

Pontos importantes:

- A aplicação deve usar `DATABASE_URL` com o role `gestao_app`.
- O role `gestao_app` não pode ter `BYPASSRLS`.
- A conexão administrativa (`ADMIN_DATABASE_URL`) é separada e só deve ser usada
  pelo futuro painel interno.
- Todo acesso de negócio deve passar por `prisma.comTenant()`.
- Dinheiro trafega como string decimal no JSON e fica como `Decimal(14, 2)` no
  banco. Não use `number`/`float` para valores monetários.

## Estrutura do Projeto

```text
apps/
  api/
    prisma/              schema e migrations
    src/
      common/            filters, guards, decorators, pipes
      config/            validação de ambiente
      infra/
        prisma/          PrismaService e tenant extension
        tenant/          contexto multi-tenant
      modules/
        auth/            login, refresh token, sessão
        onboarding/      cadastro inicial do tenant
        crm/             clientes, funil, serviços, orçamentos, agenda, lembretes
        financeiro/      categorias, lançamentos, relatórios
        health/          health check

  web/
    src/
      app/               rotas do Next.js App Router
      components/        componentes de UI
      lib/               cliente HTTP, sessão, env, helpers

packages/
  shared-types/          schemas Zod, enums e tipos compartilhados
  tsconfig/              configurações TypeScript compartilhadas

docs/
  arquitetura.md         arquitetura do produto
  status.md              histórico/status técnico do desenvolvimento
```

## Variáveis de Ambiente

### API

Arquivo local: `apps/api/.env`.

Principais variáveis:

| Variável                  | Descrição                                      |
| ------------------------- | ---------------------------------------------- |
| `DATABASE_URL`            | Conexão da aplicação com PostgreSQL            |
| `TEST_DATABASE_URL`       | Conexão usada pelos testes de integração       |
| `ADMIN_DATABASE_URL`      | Conexão administrativa futura                  |
| `JWT_SECRET`              | Segredo para assinar JWT, mínimo 32 caracteres |
| `CORS_ORIGINS`            | Origens liberadas, separadas por vírgula       |
| `ONBOARDING_PLANO_PADRAO` | Plano usado no cadastro inicial                |
| `ONBOARDING_TRIAL_DIAS`   | Duração do trial                               |
| `REDIS_URL`               | Reservado para BullMQ/Upstash                  |

Veja o modelo completo em [apps/api/.env.example](apps/api/.env.example).

### Web

Arquivo local: `apps/web/.env.local`.

| Variável              | Descrição                 |
| --------------------- | ------------------------- |
| `NEXT_PUBLIC_API_URL` | URL pública da API NestJS |

Veja o modelo em [apps/web/.env.example](apps/web/.env.example).

## Testes

Testes unitários:

```bash
pnpm test
```

Testes de integração com PostgreSQL:

```bash
pnpm --filter @gestao/api test:db
```

Os testes de integração usam `gestao_test` e verificam regras importantes, como:

- autenticação e refresh token;
- isolamento entre tenants;
- CRUDs do CRM;
- estados de orçamento e agendamento;
- financeiro e margem por serviço;
- lembretes de follow-up;
- alcance da política de RLS que a varredura de lembretes usa.

## Deploy

O alvo de produção previsto é:

| Parte      | Serviço |
| ---------- | ------- |
| Frontend   | Vercel  |
| API        | Render  |
| PostgreSQL | Render  |
| Redis      | Upstash |

Checklist de produção:

- Definir variáveis de ambiente no painel da Vercel e Render.
- Usar `DATABASE_URL` de produção com SSL.
- Rodar migrations com `pnpm --filter @gestao/api db:deploy`.
- Nunca usar `CORS_ORIGINS=*`.
- Usar `JWT_SECRET` forte e diferente do ambiente local.
- Configurar `REDIS_URL`, ou o envio automático de lembretes fica desligado.
- Configurar `SMTP_URL` e `EMAIL_REMETENTE`; sem eles os lembretes são apenas
  registrados no log, e nenhum e-mail chega ao cliente.

## Documentação

- [Arquitetura](docs/arquitetura.md)
- [Status técnico](docs/status.md)
- [Schema Prisma](apps/api/prisma/schema.prisma)
- [Migrations](apps/api/prisma/migrations)

## Notas de Desenvolvimento

- Prefira schemas Zod em `packages/shared-types` para contratos usados pela API
  e pelo frontend.
- Evite duplicar tipos de payload entre backend e web.
- Mantenha cada fatia vertical funcionando de ponta a ponta antes de iniciar a
  próxima.
- Código de domínio deve ficar em módulos claros: controller recebe HTTP,
  service aplica regra de negócio, shared-types define contrato.
