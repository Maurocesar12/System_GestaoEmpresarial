# Gestão Empresarial

SaaS multi-tenant de gestão para PME de serviço. CRM e financeiro no mesmo banco —
o que torna possível calcular margem por serviço ligando receita e custo ao
atendimento que os gerou.

A arquitetura completa está em [`docs/arquitetura.md`](docs/arquitetura.md). Este
README cobre só o que é preciso para rodar e continuar o desenvolvimento.

## Pré-requisitos

- Node.js 22 (ver [`.nvmrc`](.nvmrc))
- pnpm 11 — `npm install -g pnpm`
- PostgreSQL 15+ rodando localmente

## Rodando

```bash
pnpm install
```

Copie os arquivos de ambiente e ajuste o que precisar:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

O `JWT_SECRET` precisa de no mínimo 32 caracteres — gere um:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Prepare o banco. O script cria os bancos, os dois roles e preenche as
connection strings no `.env` — ele pede a senha do superusuário `postgres`:

```bash
powershell -ExecutionPolicy Bypass -File scripts\setup-database.ps1
```

Se você esqueceu a senha do `postgres`, há um script para redefini-la — precisa
ser executado como Administrador:

```bash
powershell -ExecutionPolicy Bypass -File scripts\resetar-senha-postgres.ps1
```

Aplique as migrations e popule os planos:

```bash
pnpm --filter @gestao/api db:migrate
pnpm --filter @gestao/api db:seed
```

Suba tudo:

```bash
pnpm dev
```

- API: <http://localhost:3333> — health check em `/health`
- Web: <http://localhost:3000>

A página inicial mostra o status da API. Verde significa que frontend e API se
enxergam, o CORS está certo e o contrato compartilhado casa nos dois lados.

## Comandos

Todos rodam na raiz e atravessam o monorepo via Turborepo:

| Comando          | O que faz                    |
| ---------------- | ---------------------------- |
| `pnpm dev`       | Sobe API e web em modo watch |
| `pnpm build`     | Build de produção de tudo    |
| `pnpm lint`      | ESLint                       |
| `pnpm typecheck` | Checagem de tipos sem emitir |
| `pnpm test`      | Testes unitários             |
| `pnpm format`    | Prettier                     |

Para rodar em um pacote só: `pnpm --filter @gestao/api test`.

Os testes de isolamento entre empresas precisam de banco e rodam à parte:

```bash
pnpm --filter @gestao/api test:db
```

## Como o isolamento entre empresas funciona

Todas as empresas dividem as mesmas tabelas, separadas pela coluna `tenant_id`.
O risco desse modelo é um `WHERE tenant_id` esquecido devolver dado da empresa
errada — e isso vaza em silêncio, sem erro nenhum no log. A defesa tem três
camadas:

| Camada                | Onde                                                                            | O que faz                                                             |
| --------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 1. Contexto           | [`tenant-context.ts`](apps/api/src/infra/tenant/tenant-context.ts)              | Guarda o tenant da requisição em `AsyncLocalStorage`                  |
| 2. Extensão do Prisma | [`tenant.extension.ts`](apps/api/src/infra/prisma/tenant.extension.ts)          | Injeta o filtro nas consultas e recusa gravação com tenant divergente |
| 3. Row-Level Security | [migration de RLS](apps/api/prisma/migrations/20260812120100_rls/migration.sql) | O banco não devolve nem aceita linha de outra empresa                 |

Na prática, todo acesso a dado passa por `prisma.comTenant()`, que abre uma
transação e define `app.current_tenant_id` nela — é essa variável que as
políticas de RLS consultam.

```ts
const clientes = await this.prisma.comTenant((tx) =>
  tx.cliente.findMany({ orderBy: { nome: 'asc' } }),
);
```

Duas coisas que não são óbvias e estão documentadas no código:

- A conexão da aplicação usa um role **sem** `BYPASSRLS`. Com ele, as políticas
  seriam ignoradas em silêncio e os testes passariam sem provar nada.
- As tabelas usam `FORCE ROW LEVEL SECURITY`, e não só `ENABLE`. O dono da
  tabela ignora as políticas por padrão — e o dono é justamente quem roda as
  migrations.

## Estrutura

```
apps/
  api/                  NestJS — backend
    src/
      common/           filtros, pipes, guards, decorators transversais
      config/           validação das variáveis de ambiente
      infra/
        prisma/         acesso ao banco (entra na próxima fatia)
        queue/          BullMQ
        tenant/         contexto de tenant (AsyncLocalStorage)
      modules/
        auth/ tenant/ onboarding/ usuarios/ billing/ admin/
        crm/            clientes, funil, servicos, orcamentos,
                        agendamentos, lembretes, notificacoes
        financeiro/     lancamentos, custos, relatorios
        marketing/      módulo beta
        health/         health check
  web/                  Next.js — aplicação do assinante
    src/
      app/              rotas (App Router)
      components/       componentes de UI
      lib/              cliente HTTP, env, utilitários
packages/
  shared-types/         enums, schemas Zod e tipos usados pelos dois lados
  tsconfig/             configurações de TypeScript compartilhadas
docs/
  arquitetura.md        documento de arquitetura
```

As pastas de módulo estão criadas e vazias de propósito: elas marcam onde cada
fatia entra, na ordem do roadmap.

O app `admin` (painel interno) ainda não existe — entra junto com o
`AdminModule`, que depende da conexão `BYPASSRLS` separada.

## Estado atual

**Pronto** — fundação e isolamento de dados (arquitetura §11, itens 1 e 2):

- Monorepo Turborepo com pnpm workspaces
- API NestJS subindo com CORS restrito, `helmet`, rate limiting e formato único de erro
- Variáveis de ambiente validadas na subida — a API se recusa a iniciar mal configurada
- Schema completo: plataforma, CRM e financeiro, com dinheiro em `Decimal` e
  índices compostos começando por `tenant_id`
- Isolamento em três camadas, com 11 testes que tentam ativamente atravessar a
  fronteira entre duas empresas
- `@gestao/shared-types` compartilhado entre API e frontend
- Next.js 16 + Tailwind 4, pronto para receber componentes do shadcn/ui
- CI no GitHub Actions: lint, tipos, testes, build, isolamento contra um
  PostgreSQL real e auditoria de dependências

**Próxima fatia** — autenticação:

1. Login com Argon2id, JWT de vida curta e refresh com rotação
2. Guards de papel (`admin`, `financeiro`, `atendente`, `tecnico`)
3. Middleware que popula o contexto de tenant a partir do JWT
4. Tenant + Onboarding — signup self-service e dados-semente

## Decisões tomadas nesta fundação

Pontos onde a implementação difere ou especifica o documento de arquitetura:

- **Zod como validação única da API**, no lugar de `class-validator`. O documento
  previa `class-validator` para os DTOs, mas isso obrigaria a declarar cada
  payload duas vezes — uma no DTO da API, outra no schema que o formulário do
  frontend usa. Com o `ZodValidationPipe`, os dois lados consomem o mesmo schema
  de `@gestao/shared-types` e não há como divergirem. Trocar de volta nesta fase
  é barato, se preferir.
- **Dinheiro trafega como string decimal** no JSON, nunca `number`. O banco guarda
  em `NUMERIC` (arquitetura §7), e `JSON.parse` de um número devolveria float de
  64 bits — o erro de arredondamento voltaria pela porta dos fundos.
- **TypeScript fixado em 5.9** e **ESLint em 9** em todo o monorepo. As versões
  mais novas de ambos (TS 7, ESLint 10) ainda quebram com os decorators do Nest e
  com o `eslint-plugin-react` que o Next puxa.
