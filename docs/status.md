# Status do projeto

**Atualizado em:** 12 de agosto de 2026
**Fase atual:** Fundação concluída — próxima fatia é schema e isolamento de dados

Este documento registra o que já existe no repositório e o que falta construir.
A referência de arquitetura é [`arquitetura.md`](arquitetura.md); as seções
citadas abaixo (§4, §9, §12…) apontam para lá.

---

## Parte 1 — O que já foi feito

### Resumo

A fundação descrita na §11 do documento de arquitetura está pronta: monorepo,
contrato compartilhado, API e frontend subindo e conversando entre si, e CI
verificando tudo. Ainda não há banco de dados, autenticação nem nenhum módulo
de negócio.

O que existe hoje sobe com `pnpm dev` e responde. A página inicial funciona como
smoke test: se ela mostra o status da API em verde, o frontend alcança a API, o
CORS está correto e o contrato de tipos casa nos dois lados.

### Ambiente verificado nesta máquina

| Item | Situação |
|---|---|
| Node.js | 22.17.1 |
| pnpm | 11.21.0 (instalado nesta sessão via `npm install -g pnpm`) |
| Git | 2.55.0 |
| PostgreSQL | **não instalado** — decidido instalar local (winget, versão 17) |
| Docker | não instalado — decidido não usar |

O `corepack enable pnpm` falhou por falta de permissão de escrita em
`C:\Program Files\nodejs`. O pnpm foi instalado pelo npm global, que aponta para
`AppData\Roaming\npm` e não exige elevação.

### Monorepo

Turborepo com pnpm workspaces. Quatro pacotes:

```
apps/api            NestJS — backend
apps/web            Next.js — aplicação do assinante
packages/shared-types   enums, schemas Zod e tipos usados pelos dois lados
packages/tsconfig       configurações de TypeScript compartilhadas
```

Arquivos de raiz configurados: `turbo.json` (tarefas `build`, `dev`, `lint`,
`typecheck`, `test`, `db:generate`), `pnpm-workspace.yaml`, `.gitignore`,
`.npmrc`, `.editorconfig`, `.prettierrc`, `.prettierignore`, `.nvmrc`, `README.md`.

Comandos de raiz — `pnpm dev`, `build`, `lint`, `typecheck`, `test`, `format` —
atravessam todos os pacotes.

### `packages/shared-types`

Contrato único entre API e frontend, compilado para `dist/` e consumido pelos
dois lados como pacote normal.

| Arquivo | Conteúdo |
|---|---|
| `enums.ts` | Papéis de usuário, status de tenant, orçamento, agendamento, lembrete; tipo e natureza de lançamento; tipo de custo |
| `auth/auth.schemas.ts` | `loginSchema`, `signupSchema`, `refreshTokenSchema`, política de senha, `JwtPayload`, `LoginResponse` |
| `common/dinheiro.ts` | `dinheiroSchema` e `formatarBRL` |
| `common/pagination.ts` | Query de paginação e envelope `Paginado<T>` |
| `common/api-response.ts` | `ApiError` e a tabela de códigos de erro |
| `health.ts` | Resposta do health check |

Cada enum é declarado uma vez como `const array`, e dele derivam o schema Zod e
o tipo TypeScript. Quando o schema Prisma entrar, os enums do banco precisam
espelhar exatamente esses valores.

### `apps/api` — NestJS

**Sobe e responde.** Verificado: `GET /health` retorna `200`, e `/api/health`
retorna `404`, confirmando que o health check fica fora do prefixo global (é o
endpoint que o Render consulta).

| Peça | Arquivo | O que faz |
|---|---|---|
| Bootstrap | `src/main.ts` | `helmet`, CORS por lista de origens, prefixo global, shutdown hooks |
| Módulo raiz | `src/app.module.ts` | ConfigModule global, ThrottlerModule, guard de rate limit |
| Ambiente | `src/config/env.schema.ts` | Valida as variáveis na subida e lista todos os problemas de uma vez |
| Contexto de tenant | `src/infra/tenant/tenant-context.ts` | `AsyncLocalStorage` — camada 1 do isolamento (§4.2) |
| Validação | `src/common/pipes/zod-validation.pipe.ts` | Valida entrada com os schemas de `shared-types` |
| Erros | `src/common/filters/all-exceptions.filter.ts` | Formato único de erro; 5xx nunca vaza stack trace |
| Health | `src/modules/health/` | Health check, isento de rate limit |

Segurança já ativa, conforme §9.2: `helmet`, rate limiting global
(120 req/min, configurável), CORS restrito por lista — nunca `*` — e formato de
erro que não expõe estrutura interna em falha de servidor.

As pastas dos módulos de negócio estão criadas e vazias, com `.gitkeep`, marcando
onde cada fatia entra: `auth`, `tenant`, `onboarding`, `usuarios`, `billing`,
`admin`, `crm/*`, `financeiro/*`, `marketing`, `infra/prisma`, `infra/queue`.

**Testes: 8 passando.**

- `tenant-context.spec.ts` (5) — contexto disponível dentro do escopo, ausente
  fora dele, erro alto quando não existe, escopos concorrentes isolados,
  escopos aninhados sem contaminação.
- `zod-validation.pipe.spec.ts` (3) — normalização de e-mail, agrupamento de
  erros por campo, e rejeição de campo desconhecido no corpo (a defesa contra
  escalada de privilégio por campo extra).

### `apps/web` — Next.js

**Compila e renderiza.** Verificado com API e frontend no ar ao mesmo tempo: a
home renderizou o status vivo da API.

| Peça | Arquivo |
|---|---|
| Layout e providers | `src/app/layout.tsx`, `src/components/providers.tsx` |
| Página de status | `src/app/page.tsx` |
| Cliente HTTP | `src/lib/api.ts` — erros tipados como `ApiRequestError` com código estável |
| Ambiente | `src/lib/env.ts` — valida `NEXT_PUBLIC_API_URL` |
| Tema | `src/app/globals.css` — tokens shadcn/ui sobre Tailwind 4 |
| Utilitário | `src/lib/utils.ts` — `cn()` |

O `QueryClient` é criado dentro de `useState`, e não no escopo do módulo: no
servidor, uma instância compartilhada faria o cache de um tenant vazar para
outro. O `components.json` está configurado, então `npx shadcn add <componente>`
funciona direto.

### CI e documentação

`.github/workflows/ci.yml` — dois jobs em push e pull request para `main`:

1. **Verificar** — install, lint, typecheck, testes e build.
2. **Auditoria** — `pnpm audit --audit-level=high` (§9.3).

`.github/dependabot.yml` — atualizações semanais de npm agrupadas por família
(NestJS, Next, dev) e mensais de GitHub Actions.

`README.md` cobre pré-requisitos, como rodar, comandos, estrutura e decisões.
`docs/arquitetura.md` é a cópia versionada do documento de arquitetura.

### Verificações executadas

Todas passaram na última execução:

| Verificação | Resultado |
|---|---|
| `pnpm lint` | Sem erros nos dois apps |
| `pnpm typecheck` | Sem erros nos quatro pacotes |
| `pnpm test` | 8 testes, 2 suítes |
| `pnpm build` | API, web e shared-types |
| Smoke test da API | `GET /health` → `200`; `/api/health` → `404` |
| Smoke test ponta a ponta | Home renderizou o status vivo da API |
| Segredos ignorados | `apps/api/.env` e `apps/web/.env.local` fora do versionamento |

### Decisões tomadas nesta fase

Pontos onde a implementação difere ou especifica o documento de arquitetura:

**Zod como validação única da API, no lugar de `class-validator`.** O documento
previa `class-validator` para os DTOs (§2), mas isso obrigaria a declarar cada
payload duas vezes — uma no DTO da API, outra no schema que o formulário do
frontend usa. Com o `ZodValidationPipe`, os dois lados consomem o mesmo schema
de `shared-types` e não há como divergirem. `class-validator` e
`class-transformer` foram removidos. Reverter ainda é barato nesta fase.

**Dinheiro trafega como string decimal no JSON, nunca `number`.** O banco guarda
em `NUMERIC` (§7), e `JSON.parse` de um número devolve float de 64 bits — o erro
de arredondamento que o `NUMERIC` evita voltaria pelo transporte.

**TypeScript fixado em 5.9 e ESLint em 9** em todo o monorepo. As versões mais
novas quebram: o TS 7 removeu a opção `baseUrl`, e o ESLint 10 é incompatível com
o `eslint-plugin-react` que o `eslint-config-next` puxa.

**Zod unificado na versão 4.** O primeiro install resolveu Zod 3 na API e Zod 4
no frontend — duas versões tornariam o contrato compartilhado inconsistente.

**O app `admin` ainda não existe.** O documento prevê `apps/admin` (§5), mas ele
depende da conexão `BYPASSRLS` separada e do `AdminModule`. Criar um app vazio
agora seria peso morto.

---

## Parte 2 — O que precisa ser feito

### Agora — instalar o PostgreSQL

Único passo bloqueante. Precisa de elevação (UAC) e da senha de superusuário
definida por você:

```
winget install PostgreSQL.PostgreSQL.17
```

Depois da instalação, três coisas antes da próxima fatia:

- [ ] Criar o banco de desenvolvimento
- [ ] Criar o usuário da aplicação **sem** `BYPASSRLS` (§4.3)
- [ ] Preencher `DATABASE_URL` em `apps/api/.env`

O usuário separado importa: com um superusuário, as políticas de RLS são
ignoradas silenciosamente e os testes de isolamento passariam sem provar nada.

### Fase A — MVP vendável

Estimativa do documento de arquitetura: 400–550h no total da fase.

#### Fatia 1 — Schema e isolamento de dados

A fatia mais crítica do projeto. É a que decide se o produto pode ou não
misturar dados de duas empresas.

- [ ] Schema Prisma completo — plataforma, CRM e financeiro
- [ ] Enums do Prisma espelhando os de `shared-types`
- [ ] Valores monetários em `NUMERIC`/`DECIMAL`, nunca `FLOAT` (§7)
- [ ] Migration inicial
- [ ] Políticas de RLS por tabela, validando `current_setting('app.current_tenant_id')`
- [ ] Índices compostos começando por `tenant_id` nas tabelas de maior volume
- [ ] `PrismaService` aplicando `SET app.current_tenant_id` por conexão
- [ ] Prisma Client Extension injetando o filtro de tenant — camada 2 (§4.2)
- [ ] `TenantMiddleware` populando o contexto a partir do JWT
- [ ] **Suíte de isolamento**: autenticar como tenant A e afirmar que não
      enxerga dado do tenant B, tabela por tabela
- [ ] Dados-semente: etapas do funil pré-criadas

Ponto de atenção: o projeto está com **Prisma 7**, versão recente com mudanças
em geração de client e configuração. Vale conferir a documentação da versão antes
de escrever o schema, em vez de assumir a API do Prisma 5/6.

#### Fatia 2 — Autenticação

- [ ] Hash de senha com Argon2id (§9.1)
- [ ] Login com access token JWT de vida curta (15–30 min)
- [ ] Refresh token com rotação a cada uso
- [ ] `tenant_id` como claim do JWT — origem do contexto de tenant
- [ ] Guards de papel: `admin`, `financeiro`, `atendente`, `tecnico` (§9.5)
- [ ] Rate limit mais apertado em login e signup
- [ ] Frontend: tela de login, cookie httpOnly + Secure + SameSite=Lax,
      middleware de rota protegida
- [ ] Envio do `Authorization` no cliente HTTP e refresh transparente

#### Fatia 3 — Tenant e onboarding

- [ ] Cadastro de organização, plano e status (trial, ativo, suspenso, cancelado)
- [ ] Signup self-service criando o tenant com dados-semente
- [ ] Convite e gestão de usuários dentro do tenant
- [ ] Frontend: fluxo de cadastro e primeira entrada

#### Fatia 4 — Billing

- [ ] Planos e limites (usuários, clientes, envios de lembrete por mês)
- [ ] Guard de limite de plano no backend (§8.2)
- [ ] Integração com Asaas — assinatura recorrente em Pix, boleto e cartão
- [ ] Webhooks de pagamento atualizando o status da assinatura
- [ ] Suspensão por inadimplência após período de tolerância
- [ ] Emissão de NFS-e disparada por pagamento confirmado (§8.1)
- [ ] Frontend: tela de plano e cobrança

#### Fatias 5 a 9 — Núcleo do CRM

Cada uma entregue de ponta a ponta, backend e frontend juntos (§11).

- [ ] **Clientes** — cadastro, histórico de atendimento, captura de origem e UTM
- [ ] **Funil** — etapas, movimentação, kanban com dnd-kit
- [ ] **Serviços** — catálogo com custo base, insumo do cálculo de margem
- [ ] **Orçamentos** — criação, status e transições
- [ ] **Agendamentos** — serviços agendados e seus status
- [ ] **Lembretes** — follow-up automático via BullMQ, com o `tenant_id` no
      payload do job e restaurado no contexto ao processar (§4.3)
- [ ] **Notificações** — e-mail transacional e WhatsApp utility

#### Fatia 10 — Marketing (beta)

Escopo mínimo, marcado como Beta na interface e fora dos planos pagos (§8.3):

- [ ] Relatório de leads por origem e conversão por etapa do funil
- [ ] Formulário embedável, com aviso de coleta e base legal (§9.4)
- [ ] Instrumentação de uso — quantos tenants realmente usam

### Fase B — Financeiro

Estimativa do documento: 130–195h.

- [ ] Lançamentos de entrada e saída, com separação pessoal/empresa
- [ ] Categorias e custos fixos/variáveis
- [ ] Custo operacional diário
- [ ] Fluxo de caixa e faturamento semanal/mensal
- [ ] Margem por serviço — o diferencial do produto
- [ ] Pró-labore e reserva
- [ ] Dashboards com Recharts

Fluxo de caixa, faturamento e margem são calculados por queries agregadas, não
são tabelas próprias.

### Transversal — LGPD

Exigência elevada por combinar dado de cliente e dado financeiro de várias
empresas (§9.4). Vale implementar junto das fatias, não no fim:

- [ ] Log de auditoria em `LancamentoFinanceiro`, `Cliente` e `User`
- [ ] Política de retenção definida e publicada
- [ ] Exclusão de dados sob solicitação, inclusive no cancelamento do tenant
- [ ] Termos de uso e política de privacidade

### Deploy

Nada foi provisionado ainda.

- [ ] API e PostgreSQL no Render, com SSL obrigatório na conexão
- [ ] Frontend na Vercel
- [ ] Redis no Upstash
- [ ] Variáveis de ambiente de produção nos dois painéis
- [ ] Deploy vazio funcionando nas duas pontas antes das fatias de negócio (§11)

### Pendências técnicas conhecidas

Pequenas, sem impacto no que funciona hoje, mas vale limpar:

- [ ] `package.json` da raiz declara `turbo ^2.3.3` e `typescript ^5.7.2`
      enquanto o instalado é 2.10.9 e 5.9.3 — alinhar os ranges
- [ ] `packages/shared-types` declara `typescript ^5.7.2`; padronizar em ^5.9.3
- [ ] `apps/api` tem `@eslint/js ^10` convivendo com `eslint ^9` — alinhar em ^9
- [ ] `apps/api` tem `tsconfig-paths` instalado sem uso (os path aliases foram
      removidos de propósito: o `tsc` não os reescreve no output e `node dist/main`
      quebraria em produção)
- [ ] Nenhum commit foi feito ainda — a árvore está limpa e pronta

### Decisões de negócio ainda em aberto

Da §12 do documento de arquitetura. Não bloqueiam o schema de plataforma nem o
de CRM, mas precisam estar fechadas antes dos módulos correspondentes:

| Decisão | Bloqueia |
|---|---|
| Fórmulas financeiras — custo operacional diário, o que entra como custo na margem | Fase B |
| Máquina de estados de orçamento e agendamento | Fatias 7 e 8 |
| Regras do funil — pular etapa, voltar, movimentação automática | Fatia 6 |
| Lembretes — gatilho, canal, destinatário, comportamento sem resposta | Fatia 9 |
| Planos — quantos, quais limites, preço, duração do trial | Fatia 4 |
| Política de upgrade/downgrade e tratamento de inadimplência | Fatia 4 |

A mais urgente é a dos planos: ela entra em Billing, que vem logo depois do
onboarding.
