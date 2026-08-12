# Arquitetura — SaaS de Gestão Empresarial

## 1. Visão Geral

Plataforma SaaS multi-tenant de gestão para pequenas e médias empresas de serviço. O produto substitui o controle feito em papel, WhatsApp e planilhas soltas por um sistema único.

**Núcleo do produto** (o que define o posicionamento):
- **CRM** — clientes, funil de vendas, orçamentos, agendamentos, histórico e follow-up.
- **Financeiro** — entradas, saídas, custos, fluxo de caixa, pró-labore e margem por serviço.

**Diferencial**: a maioria dos CRMs de mercado não tem financeiro, e a maioria dos financeiros não tem CRM. Aqui os dois vivem no mesmo banco — o que torna possível calcular margem de lucro por tipo de serviço ligando receita e custo ao atendimento que os gerou.

**Marketing entra como módulo beta**, com escopo mínimo (ver seção 8.3). Não é o foco do produto e não é item de plano pago no lançamento.

**Premissas**
- **Multi-tenant** desde a primeira migration.
- Sem migração de dados legados — cada tenant começa zerado, com dados-semente (etapas do funil pré-criadas).
- Público-alvo: PME brasileira de serviço, com equipe pequena.
- Uso interno da equipe assinante — não há portal para o cliente final do assinante.

## 2. Stack Tecnológica

### Backend

| Camada | Tecnologia |
|---|---|
| Runtime / Framework | Node.js + NestJS (TypeScript) |
| Banco de dados | PostgreSQL 15+ |
| ORM | Prisma (+ Client Extension para escopo de tenant) |
| Isolamento de dados | Row-Level Security (RLS) do PostgreSQL |
| Autenticação | Passport.js + JWT (`@nestjs/passport`, `@nestjs/jwt`) |
| Hash de senha | `argon2` (Argon2id) |
| Fila de jobs | BullMQ (`@nestjs/bullmq`) sobre Redis |
| Agendamento (cron) | `@nestjs/schedule` |
| Validação | class-validator / class-transformer (DTOs) |
| Cabeçalhos HTTP | `helmet` |
| Rate limiting | `@nestjs/throttler` |
| Pagamentos | Asaas (API de assinatura recorrente) |
| NFS-e | Integração via emissor (Nibo / Omie / municipal) |

### Frontend

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) + TypeScript |
| Estilo / UI | Tailwind CSS + shadcn/ui |
| Dados do servidor | TanStack Query |
| Tabelas | TanStack Table |
| Formulários | React Hook Form + Zod |
| Funil (kanban) | dnd-kit |
| Gráficos | Recharts |
| Estado global leve | Zustand |

### Infraestrutura

| Item | Serviço |
|---|---|
| API + PostgreSQL | Render |
| Frontend | Vercel |
| Redis | Upstash |
| Monorepo | Turborepo |

## 3. Arquitetura Geral

```
┌────────────────────┐    REST / HTTPS (JWT)    ┌────────────────────┐
│ Frontend            │ ────────────────────────▶ │ API                 │
│ Next.js — Vercel    │ ◀──────────────────────── │ NestJS — Render     │
└────────────────────┘           JSON             └──────────┬─────────┘
                                                                │ Prisma
                                                                │ (tenant scoped)
                                                                ▼
                                                     ┌────────────────────┐
                                                     │ PostgreSQL + RLS    │
                                                     │ Render               │
                                                     └────────────────────┘
                                                                ▲
                                            ┌───────────────────┼───────────────────┐
                                            │                   │                   │
                                 ┌──────────┴────────┐ ┌────────┴───────┐ ┌────────┴───────┐
                                 │ BullMQ + Redis     │ │ Asaas          │ │ WhatsApp API   │
                                 │ lembretes / jobs   │ │ webhooks       │ │ utility msg    │
                                 └───────────────────┘ └────────────────┘ └────────────────┘
```

O frontend nunca acessa o banco diretamente. Toda comunicação passa pela API REST autenticada por JWT.

## 4. Multi-tenancy

### 4.1 Padrão adotado

**Shared database, shared schema**: uma única base, com `tenant_id` em todas as tabelas de negócio. É o padrão de menor custo operacional e escala bem para milhares de tenants. Database-per-tenant só se algum dia uma exigência regulatória obrigar.

### 4.2 Isolamento em três camadas

O risco desse padrão é um `WHERE tenant_id` esquecido vazar dado entre empresas. A defesa é em profundidade:

1. **Contexto de requisição** — o `tenant_id` vem do JWT e é carregado num contexto por requisição (AsyncLocalStorage). Se algo tentar acessar dados fora de um contexto válido, lança erro.
2. **Prisma Client Extension** — intercepta toda query e injeta o filtro de tenant automaticamente. O desenvolvedor não precisa lembrar do filtro; ele não é opcional.
3. **Row-Level Security no PostgreSQL** — política por tabela validando `tenant_id = current_setting('app.current_tenant_id')::uuid`. Rede de segurança final: mesmo com bug na aplicação, o banco recusa.

Para vazar dado seria preciso furar as três camadas ao mesmo tempo.

### 4.3 Regras de operação

- A aplicação conecta no Postgres com usuário **sem** `BYPASSRLS` (princípio do menor privilégio).
- O painel administrativo interno usa uma **connection string separada**, com usuário `BYPASSRLS`, isolado do resto da aplicação.
- **Jobs em background (BullMQ)**: o `tenant_id` precisa ser gravado no payload do job e restaurado no contexto ao processar. Job sem tenant no contexto deve falhar, nunca rodar sem escopo.
- **Testes de isolamento explícitos**: suíte automatizada que autentica como tenant A e afirma que não enxerga dado do tenant B. Bug de isolamento não se anuncia — vaza em silêncio.
- Índice composto começando por `tenant_id` nas tabelas de maior volume.

## 5. Estrutura do Monorepo (Turborepo)

```
/apps
  /api            → NestJS (backend)
  /web            → Next.js (aplicação do assinante)
  /admin          → painel interno (gestão de tenants, suporte)
/packages
  /shared-types   → tipos e schemas Zod compartilhados
```

## 6. Módulos do Backend

### Plataforma
- **AuthModule** — login, JWT, refresh token, guards de papel.
- **TenantModule** — organizações, plano contratado, status (trial, ativo, suspenso, cancelado).
- **OnboardingModule** — signup self-service, criação do tenant, dados-semente.
- **UsuariosModule** — convite e gestão de usuários dentro do tenant.
- **BillingModule** — planos, limites, integração Asaas, webhooks de pagamento, NFS-e.
- **AdminModule** — visão interna de tenants e uso (conexão `BYPASSRLS`).

### Núcleo — CRM
- **ClientesModule** — cadastro e histórico de atendimento.
- **FunilModule** — etapas e movimentação do cliente entre elas.
- **ServicosModule** — catálogo de serviços do tenant.
- **OrcamentosModule** — orçamentos e status.
- **AgendamentosModule** — serviços agendados.
- **LembretesModule** — follow-up automático (fila BullMQ).
- **NotificacoesModule** — e-mail transacional e WhatsApp utility.

### Núcleo — Financeiro
- **FinanceiroModule** — lançamentos de entrada e saída, separação pessoal/empresa.
- **CustosModule** — custos fixos e variáveis, custo operacional diário.
- **RelatoriosModule** — fluxo de caixa, faturamento semanal/mensal, margem por serviço, pró-labore, reserva.

### Beta
- **MarketingModule** — origem de lead, UTM, formulário embedável, métricas de conversão.

## 7. Modelo de Dados (visão geral)

> Todas as tabelas de negócio carregam `tenant_id` e estão sob política RLS.

### Plataforma

| Entidade | Campos principais |
|---|---|
| `Tenant` | nome, cnpj, plano_id, status, criado_em |
| `Plano` | nome, preco, limites (usuários, clientes, envios) |
| `Assinatura` | tenant_id, asaas_id, status, proximo_vencimento |
| `User` | tenant_id, nome, email, senha (Argon2id), papel |

Papéis: `admin`, `financeiro`, `atendente`, `tecnico`.

### CRM

| Entidade | Campos principais | Observações |
|---|---|---|
| `Cliente` | nome, contato, origem, utm_source/medium/campaign | `origem` alimenta o módulo beta |
| `Atendimento` | cliente_id, descrição, data | Histórico de serviços |
| `Servico` | nome, categoria, custo_base | Base do cálculo de margem |
| `Orcamento` | cliente_id, servico_id, valor, status | Status: aberto, aprovado, recusado |
| `Agendamento` | cliente_id, servico_id, data, status | |
| `EtapaFunil` | nome, ordem | Semente: Novo contato → Diagnóstico → Orçamento enviado → Follow-up → Fechado → Serviço executado → Pós-venda |
| `ClienteFunil` | cliente_id, etapa_id, atualizado_em | Posição atual no funil |
| `LembreteFollowUp` | cliente_id, data_envio, canal, status | Canal: e-mail ou WhatsApp utility |

### Financeiro

| Entidade | Campos principais | Observações |
|---|---|---|
| `LancamentoFinanceiro` | tipo, valor, categoria_id, natureza, data, servico_id | `natureza`: pessoal ou empresa |
| `CategoriaFinanceira` | nome, tipo_custo (fixo/variável) | |
| `ProLabore` | valor, vigência | |
| `ReservaFinanceira` | valor_atual, meta | |

**Regra crítica**: todo valor monetário em `NUMERIC`/`DECIMAL`, nunca `FLOAT` — evita erro de arredondamento acumulado no fluxo de caixa e na margem.

Fluxo de caixa, faturamento e margem por serviço são **calculados** por queries agregadas, não são tabelas próprias.

## 8. Planos, Billing e Beta

### 8.1 Assinatura
- Gateway: **Asaas** — recorrência em Pix, boleto e cartão. Pix recorrente é o diferencial para o público PME brasileiro.
- Webhooks de pagamento atualizam o status da assinatura; inadimplência suspende o acesso após período de tolerância.
- **NFS-e obrigatória**: SaaS por assinatura é prestação de serviço. ISS de 2% a 5% conforme município. Emissão disparada por webhook de pagamento confirmado.
- Política de upgrade/downgrade (cobrança imediata ou na renovação, crédito proporcional) definida **antes** do lançamento.

### 8.2 Limites por plano
Aplicados como guard no backend: número de usuários, de clientes cadastrados e de envios de lembrete por mês.

### 8.3 Módulo de marketing — escopo beta

Entra apenas o mínimo:
- Campo de origem do lead + captura automática de UTM.
- Relatório de leads por origem e conversão por etapa do funil.
- Formulário embedável (script que o assinante cola no próprio site; o lead cai na primeira etapa do funil já com origem marcada).

**Fora do beta** (backlog, sem data): e-mail marketing, campanhas de WhatsApp, construtor de landing pages.

**Regras do beta**:
- Marcado como "Beta" na interface.
- Não é item de plano pago nem argumento de venda — mantém a liberdade de mudar ou remover.
- Uso instrumentado: quantos tenants realmente usam. Esse dado decide se vale investir no marketing completo.

> Nota: o lembrete de follow-up via WhatsApp **não** é marketing — é mensagem *utility* (custo bem menor que marketing, e gratuita dentro da janela de 24h após resposta do cliente). Permanece no núcleo do CRM.

## 9. Segurança

### 9.1 Autenticação e sessão
- Senhas com **Argon2id** — recomendação atual da OWASP para projetos novos.
- Access token JWT de vida curta (15-30 min) + refresh token com rotação a cada uso.
- O JWT carrega o `tenant_id` como claim — é a origem do contexto de tenant.
- A API devolve o token no corpo da resposta; o Next.js grava em cookie **httpOnly + Secure + SameSite=Lax** (API e frontend ficam em domínios diferentes, então não há cookie automático entre eles). Nunca em `localStorage`.
- Validação do JWT sempre no NestJS. O Middleware do Next.js apenas confere presença do cookie para redirecionar rota protegida.

### 9.2 Proteção da API
- `helmet` — cabeçalhos de segurança (CSP, X-Frame-Options).
- `@nestjs/throttler` — rate limiting, com atenção especial em login e signup.
- CORS restrito aos domínios do frontend — nunca `origin: '*'`.
- DTOs validados com `class-validator` em toda entrada.

### 9.3 Proteção de dados
- Prisma parametriza queries por padrão (proteção contra SQL injection) — evitar `$queryRawUnsafe`.
- Segredos apenas em variáveis de ambiente do Render/Vercel, nunca no repositório.
- Conexão Postgres com SSL obrigatório.
- Scan de dependências no CI (Dependabot / `npm audit`).

### 9.4 LGPD
Dado de cliente + dado financeiro de múltiplas empresas elevam a exigência:
- Log de auditoria em tabelas sensíveis (`LancamentoFinanceiro`, `Cliente`, `User`) — quem alterou, quando, o quê.
- Política de retenção definida e publicada.
- Exclusão de dados mediante solicitação (direito ao esquecimento), inclusive no cancelamento do tenant.
- Termos de uso e política de privacidade — o SaaS é **operador** dos dados que o assinante controla.
- Formulário embedável exige aviso de coleta e base legal para o lead capturado.

### 9.5 Permissões por papel
- **Financeiro** (pró-labore, reserva, margem, fluxo de caixa) — `admin` e `financeiro`.
- **CRM** (clientes, funil, orçamento, agendamento) — `admin`, `atendente`, `tecnico`.

## 10. Roadmap

Cada fase é vendável por si só. A ordem prioriza colocar produto na mão de assinante real o quanto antes.

### Fase A — MVP vendável *(~400-550h)*
Fundação (schema, RLS, contrato da API, CI/CD) → Auth + Tenant + Onboarding → Billing (Asaas) → Clientes → Funil → Orçamentos → Agendamentos → Lembretes → Marketing beta

### Fase B — Financeiro *(~130-195h)*
Lançamentos → Custos fixos/variáveis → Fluxo de caixa → Dashboards → Pró-labore → Reserva → Margem por serviço

**Total estimado: ~520-810h.**

### Backlog (dirigido por demanda de assinante)
WhatsApp marketing · E-mail marketing · Construtor de landing pages · App mobile

## 11. Ordem de Execução

Não construir "backend inteiro depois frontend inteiro". O método é:

1. **Fundação primeiro** — schema Prisma, contrato da API, tipos compartilhados, monorepo, CI/CD, deploy vazio funcionando nas duas pontas, módulo de Auth completo.
2. **Fatias verticais depois** — cada funcionalidade entregue de ponta a ponta (backend + frontend + funcionando), respeitando a dependência entre elas.

Ao fim de cada fatia existe algo que dá para abrir e usar. Requisito mal entendido custa uma semana em vez de dois meses.

## 12. Especificações a Fechar Antes de Codar

Decisões de negócio, não de implementação. Cada uma travada no meio do desenvolvimento gera retrabalho:

- **Fórmulas financeiras**, item por item: como se calcula custo operacional diário? Margem por serviço considera o quê como custo?
- **Máquina de estados** de orçamento e agendamento: quais status existem e quais transições são permitidas.
- **Regras do funil**: pode pular etapa? Volta atrás? Movimentação automática (orçamento aprovado → "Fechado")?
- **Lembretes**: gatilho, canal, destinatário, comportamento sem resposta.
- **Planos**: quantos, quais limites, preço, duração do trial.
- **Política de upgrade/downgrade** e tratamento de inadimplência.

## 13. Próximos Passos

- Schema completo do Postgres (DDL, políticas RLS, índices).
- Contrato da API (rotas, payloads de request/response).
- Definição comercial dos planos e preços.
- Wireframe das telas principais (funil kanban, dashboard financeiro, onboarding).
