# Gestão Empresarial

SaaS multi-tenant de gestão para PME de serviço. CRM e financeiro no mesmo banco —
o que torna possível calcular margem por serviço ligando receita e custo ao
atendimento que os gerou.

A arquitetura completa está em [`docs/arquitetura.md`](docs/arquitetura.md). Este
README cobre só o que é preciso para rodar e continuar o desenvolvimento.

## Pré-requisitos

- Node.js 22 (ver [`.nvmrc`](.nvmrc))
- pnpm 11 — `npm install -g pnpm`
- PostgreSQL 15+ — **ainda não é necessário**; entra na próxima fatia

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
| `pnpm test`      | Testes                       |
| `pnpm format`    | Prettier                     |

Para rodar em um pacote só: `pnpm --filter @gestao/api test`.

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

**Pronto** — fundação (arquitetura §11, item 1):

- Monorepo Turborepo com pnpm workspaces
- API NestJS subindo com CORS restrito, `helmet`, rate limiting e formato único de erro
- Variáveis de ambiente validadas na subida — a API se recusa a iniciar mal configurada
- Contexto de tenant por requisição (`AsyncLocalStorage`), com testes de isolamento
- `@gestao/shared-types` compartilhado entre API e frontend
- Next.js 16 + Tailwind 4, pronto para receber componentes do shadcn/ui
- CI no GitHub Actions: lint, tipos, testes, build e auditoria de dependências

**Próxima fatia** — schema e isolamento de dados:

1. Schema Prisma, políticas de RLS, índices e testes de isolamento entre tenants
2. Auth — login, JWT, refresh com rotação, guards de papel
3. Tenant + Onboarding — signup self-service e dados-semente

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
