# Status do projeto

**Atualizado em:** 12 de agosto de 2026
**Fase atual:** Fundação e isolamento de dados concluídos — próxima fatia é autenticação

Este documento registra o que já existe no repositório e o que falta construir.
A referência de arquitetura é [`arquitetura.md`](arquitetura.md); as seções
citadas abaixo (§4, §9, §12…) apontam para lá.

---

## Parte 1 — O que já foi feito

### Resumo

Os dois primeiros itens da §11 estão prontos: a fundação (monorepo, contrato
compartilhado, API e frontend conversando entre si) e o schema com o isolamento
entre empresas funcionando e testado. Ainda não há autenticação nem módulo de
negócio.

O que existe hoje sobe com `pnpm dev` e responde. A página inicial funciona como
smoke test: se ela mostra o status da API em verde, o frontend alcança a API, o
CORS está correto e o contrato de tipos casa nos dois lados.

O banco está criado, com as duas migrations aplicadas e os planos populados.
A suíte de isolamento roda contra ele e passa: 11 testes que tentam ativamente
ler, alterar e apagar dados de uma empresa a partir de outra — todos barrados.

### Ambiente verificado nesta máquina

| Item       | Situação                                                   |
| ---------- | ---------------------------------------------------------- |
| Node.js    | 22.17.1                                                    |
| pnpm       | 11.21.0 (instalado nesta sessão via `npm install -g pnpm`) |
| Git        | 2.55.0                                                     |
| PostgreSQL | 17.10, serviço `postgresql-x64-17` rodando na porta 5432   |
| Docker     | não instalado — decidido não usar                          |

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

| Arquivo                  | Conteúdo                                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `enums.ts`               | Papéis de usuário, status de tenant, orçamento, agendamento, lembrete; tipo e natureza de lançamento; tipo de custo |
| `auth/auth.schemas.ts`   | `loginSchema`, `signupSchema`, `refreshTokenSchema`, política de senha, `JwtPayload`, `LoginResponse`               |
| `common/dinheiro.ts`     | `dinheiroSchema` e `formatarBRL`                                                                                    |
| `common/pagination.ts`   | Query de paginação e envelope `Paginado<T>`                                                                         |
| `common/api-response.ts` | `ApiError` e a tabela de códigos de erro                                                                            |
| `health.ts`              | Resposta do health check                                                                                            |

Cada enum é declarado uma vez como `const array`, e dele derivam o schema Zod e
o tipo TypeScript. Quando o schema Prisma entrar, os enums do banco precisam
espelhar exatamente esses valores.

### `apps/api` — NestJS

**Sobe e responde.** Verificado: `GET /health` retorna `200`, e `/api/health`
retorna `404`, confirmando que o health check fica fora do prefixo global (é o
endpoint que o Render consulta).

| Peça               | Arquivo                                       | O que faz                                                           |
| ------------------ | --------------------------------------------- | ------------------------------------------------------------------- |
| Bootstrap          | `src/main.ts`                                 | `helmet`, CORS por lista de origens, prefixo global, shutdown hooks |
| Módulo raiz        | `src/app.module.ts`                           | ConfigModule global, ThrottlerModule, guard de rate limit           |
| Ambiente           | `src/config/env.schema.ts`                    | Valida as variáveis na subida e lista todos os problemas de uma vez |
| Contexto de tenant | `src/infra/tenant/tenant-context.ts`          | `AsyncLocalStorage` — camada 1 do isolamento (§4.2)                 |
| Validação          | `src/common/pipes/zod-validation.pipe.ts`     | Valida entrada com os schemas de `shared-types`                     |
| Erros              | `src/common/filters/all-exceptions.filter.ts` | Formato único de erro; 5xx nunca vaza stack trace                   |
| Health             | `src/modules/health/`                         | Health check, isento de rate limit                                  |

Segurança já ativa, conforme §9.2: `helmet`, rate limiting global
(120 req/min, configurável), CORS restrito por lista — nunca `*` — e formato de
erro que não expõe estrutura interna em falha de servidor.

As pastas dos módulos de negócio estão criadas e vazias, com `.gitkeep`, marcando
onde cada fatia entra: `auth`, `tenant`, `onboarding`, `usuarios`, `billing`,
`admin`, `crm/*`, `financeiro/*`, `marketing`, `infra/prisma`, `infra/queue`.

**Testes unitários: 12 passando.**

- `tenant-context.spec.ts` (5) — contexto disponível dentro do escopo, ausente
  fora dele, erro alto quando não existe, escopos concorrentes isolados,
  escopos aninhados sem contaminação.
- `zod-validation.pipe.spec.ts` (3) — normalização de e-mail, agrupamento de
  erros por campo, e rejeição de campo desconhecido no corpo (a defesa contra
  escalada de privilégio por campo extra).
- `uuid.spec.ts` (4) — formato canônico, versão e variante corretas, ordenação
  cronológica e ausência de colisão no mesmo milissegundo.

### Banco de dados e isolamento

Esta é a parte mais crítica do projeto: é ela que decide se o produto pode ou
não misturar dados de duas empresas.

**Ambiente local.** PostgreSQL 17 instalado, com dois bancos (`gestao_dev` e
`gestao_test`) e dois roles: `gestao_app`, **sem** `BYPASSRLS`, por onde a
aplicação fala com o banco; e `gestao_admin`, com `BYPASSRLS`, reservado ao
futuro painel interno. Os scripts em `scripts/` criam tudo e gravam as
connection strings no `.env`.

**Schema** (`prisma/schema.prisma`) — 17 modelos:

| Área       | Modelos                                                                                                           |
| ---------- | ----------------------------------------------------------------------------------------------------------------- |
| Plataforma | `Plano`, `Tenant`, `Assinatura`, `Usuario`, `RefreshToken`                                                        |
| CRM        | `Cliente`, `Atendimento`, `Servico`, `Orcamento`, `Agendamento`, `EtapaFunil`, `ClienteFunil`, `LembreteFollowUp` |
| Financeiro | `CategoriaFinanceira`, `LancamentoFinanceiro`, `ProLabore`, `ReservaFinanceira`                                   |
| Auditoria  | `LogAuditoria`                                                                                                    |

Dinheiro em `Decimal(14,2)`, IDs em `uuid` nativo, índices compostos começando
por `tenant_id`, e enums espelhando os de `shared-types`.

**As três camadas de isolamento** (§4.2):

| Camada             | Arquivo                            | Papel                                                   |
| ------------------ | ---------------------------------- | ------------------------------------------------------- |
| 1. Contexto        | `infra/tenant/tenant-context.ts`   | Tenant da requisição em `AsyncLocalStorage`             |
| 2. Extensão Prisma | `infra/prisma/tenant.extension.ts` | Injeta o filtro e recusa gravação com tenant divergente |
| 3. RLS             | migration `20260812120100_rls`     | O banco não devolve nem aceita linha de outra empresa   |

O `PrismaService.comTenant()` amarra as três: abre uma transação e define
`app.current_tenant_id` nela, que é o que as políticas consultam. O valor é
local à transação de propósito — o Prisma reaproveita conexões, e um `SET`
comum grudaria o tenant na conexão, fazendo a próxima requisição herdar o
tenant errado.

**Testes de isolamento: 11 passando** (`isolamento.int-spec.ts`), contra o banco
real. Verificam que a conexão não tem `BYPASSRLS`, que toda tabela com
`tenant_id` está coberta por política, e que uma empresa não consegue ler,
alterar, apagar nem contar registros de outra — inclusive sabendo o id exato e
inclusive por SQL cru.

### `apps/web` — Next.js

**Compila e renderiza.** Verificado com API e frontend no ar ao mesmo tempo: a
home renderizou o status vivo da API.

| Peça               | Arquivo                                                                    |
| ------------------ | -------------------------------------------------------------------------- |
| Layout e providers | `src/app/layout.tsx`, `src/components/providers.tsx`                       |
| Página de status   | `src/app/page.tsx`                                                         |
| Cliente HTTP       | `src/lib/api.ts` — erros tipados como `ApiRequestError` com código estável |
| Ambiente           | `src/lib/env.ts` — valida `NEXT_PUBLIC_API_URL`                            |
| Tema               | `src/app/globals.css` — tokens shadcn/ui sobre Tailwind 4                  |
| Utilitário         | `src/lib/utils.ts` — `cn()`                                                |

O `QueryClient` é criado dentro de `useState`, e não no escopo do módulo: no
servidor, uma instância compartilhada faria o cache de um tenant vazar para
outro. O `components.json` está configurado, então `npx shadcn add <componente>`
funciona direto.

### CI e documentação

`.github/workflows/ci.yml` — três jobs em push e pull request para `main`:

1. **Verificar** — install, lint, typecheck, testes unitários e build.
2. **Isolamento** — sobe um PostgreSQL 17 de verdade, cria o role sem
   `BYPASSRLS`, aplica as migrations e roda a suíte de isolamento. Com banco
   mockado o teste passaria sempre, inclusive com a RLS desligada.
3. **Auditoria** — `pnpm audit --audit-level=high` (§9.3).

`.github/dependabot.yml` — atualizações semanais de npm agrupadas por família
(NestJS, Next, dev) e mensais de GitHub Actions.

`README.md` cobre pré-requisitos, como rodar, comandos, estrutura e decisões.
`docs/arquitetura.md` é a cópia versionada do documento de arquitetura.

### Verificações executadas

Todas passaram na última execução:

| Verificação              | Resultado                                                     |
| ------------------------ | ------------------------------------------------------------- |
| `pnpm lint`              | Sem erros nos dois apps                                       |
| `pnpm typecheck`         | Sem erros nos quatro pacotes                                  |
| `pnpm test`              | 8 testes, 2 suítes                                            |
| `pnpm build`             | API, web e shared-types                                       |
| Smoke test da API        | `GET /health` → `200`; `/api/health` → `404`                  |
| Smoke test ponta a ponta | Home renderizou o status vivo da API                          |
| Segredos ignorados       | `apps/api/.env` e `apps/web/.env.local` fora do versionamento |

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

**A extensão do Prisma valida em vez de sobrescrever.** O plano original era ela
preencher o `tenantId` silenciosamente. Mas o tipo gerado pelo Prisma exige o
campo no `create`, e sobrescrever o que o desenvolvedor escreveu esconderia o
bug em vez de revelá-lo. Hoje o código passa `tenantId: tenantAtual()`
explicitamente, e a extensão recusa qualquer valor diferente do contexto.

**UUID v7 implementado no projeto** (`common/uuid.ts`), sem dependência. A
biblioteca `uuid` na versão atual é ESM puro e não carrega no Jest deste
projeto, que roda em CommonJS — configurar a transformação custaria mais que as
quinze linhas da função.

**Não há política de RLS de exceção para o cadastro self-service.** A primeira
versão tinha uma, e ela não funcionava: o Prisma usa `RETURNING` no `create`, e
sob RLS o `RETURNING` exige que a linha também possa ser **lida** de volta —
sem contexto, não pode. A solução foi eliminar a necessidade da exceção,
gerando o id da empresa na aplicação e definindo o contexto antes do INSERT.

---

## Parte 2 — O que precisa ser feito

### Fase A — MVP vendável

Estimativa do documento de arquitetura: 400–550h no total da fase.

#### Fatia 2 — Autenticação

Próxima a ser feita. As tabelas `Usuario` e `RefreshToken` já existem no schema.

- [ ] Hash de senha com Argon2id (§9.1)
- [ ] Login com access token JWT de vida curta (15–30 min)
- [ ] Refresh token com rotação a cada uso — guardar o hash, nunca o token
- [ ] `tenant_id` como claim do JWT — origem do contexto de tenant
- [ ] **`TenantMiddleware`** populando o `AsyncLocalStorage` a partir do JWT.
      É a peça que falta para fechar a camada 1: hoje o contexto existe e é
      testado, mas ninguém o preenche automaticamente numa requisição HTTP
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
- [ ] O seed cria três planos com preços e limites **provisórios** — são valores
      para desenvolver, não decisão comercial (§12)
- [ ] `Assinatura.status` é `VarChar(30)` livre, esperando a definição dos
      status que o Asaas devolve; vira enum quando o BillingModule entrar

### Decisões de negócio ainda em aberto

Da §12 do documento de arquitetura. Não bloqueiam o schema de plataforma nem o
de CRM, mas precisam estar fechadas antes dos módulos correspondentes:

| Decisão                                                                           | Bloqueia     |
| --------------------------------------------------------------------------------- | ------------ |
| Fórmulas financeiras — custo operacional diário, o que entra como custo na margem | Fase B       |
| Máquina de estados de orçamento e agendamento                                     | Fatias 7 e 8 |
| Regras do funil — pular etapa, voltar, movimentação automática                    | Fatia 6      |
| Lembretes — gatilho, canal, destinatário, comportamento sem resposta              | Fatia 9      |
| Planos — quantos, quais limites, preço, duração do trial                          | Fatia 4      |
| Política de upgrade/downgrade e tratamento de inadimplência                       | Fatia 4      |

A mais urgente é a dos planos: ela entra em Billing, que vem logo depois do
onboarding.
