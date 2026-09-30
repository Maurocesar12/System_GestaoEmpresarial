-- ============================================================================
--  Recorrência e parcelamento
-- ============================================================================
--
--  Os dois resolvem o mesmo incômodo por caminhos diferentes: um lançamento só
--  não dava conta de uma despesa que repete nem de uma venda dividida.
--
--  PARCELAMENTO — colunas no próprio lançamento
--
--  Venda de R$ 3.000 em 3x vira **três linhas** de R$ 1.000, cada uma com seu
--  vencimento e sua baixa. Não é uma linha com "3x" escrito: cada parcela é uma
--  conta a receber de verdade, que vence, atrasa e é baixada sozinha — e todo o
--  resto do módulo (contas em aberto, fluxo de caixa, conciliação) já sabe
--  trabalhar com isso, sem uma linha de código novo.
--
--  As três colunas (`grupo_id`, `parcela`, `total_parcelas`) só existem para
--  que a tela possa dizer "2/3" e reencontrar as irmãs. Uma tabela de
--  parcelamento seria uma tabela cujas linhas não guardariam nada além do que
--  já está aqui.
--
--  RECORRÊNCIA — tabela de molde, não de lançamento
--
--  Aluguel todo dia 10 não tem fim conhecido, então não dá para materializar
--  todas as ocorrências de uma vez. A tabela `lancamento_recorrente` guarda o
--  **molde** (o quê, quanto, de quanto em quanto tempo); um agendador diário
--  transforma o molde em lançamento quando a data se aproxima.
--
--  O CURSOR É UM CONTADOR, NÃO UMA DATA
--
--  `inicio` nunca muda e `ocorrencias` conta quantas já foram geradas. A data
--  da próxima é calculada a partir do início — nunca da anterior.
--
--  O motivo é uma armadilha que só aparece meses depois: um aluguel que vence
--  dia 31 precisa encurtar ao passar por fevereiro (31/01 → 28/02). Se a
--  ocorrência seguinte fosse calculada a partir de 28/02, daria 28/03, e o
--  vencimento nunca mais voltaria ao dia 31 — a conta migraria de dia sozinha.
--  Com o contador, o encurtamento vale só para o mês curto.
--
--  `proxima_em` segue existindo como coluna porque é por ela que o agendador
--  procura e a tela ordena. É derivada de `inicio` + `ocorrencias` e regravada
--  na mesma transação que cria o lançamento — e é essa gravação que torna a
--  geração idempotente: uma segunda passagem no mesmo dia não reencontra o
--  molde.
-- ============================================================================

-- ----------------------------------------------------------------------------
--  De quanto em quanto tempo
-- ----------------------------------------------------------------------------

CREATE TYPE "periodicidade" AS ENUM ('semanal', 'mensal', 'trimestral', 'anual');

-- ----------------------------------------------------------------------------
--  Parcelamento: colunas no lançamento
-- ----------------------------------------------------------------------------

ALTER TABLE "lancamento_financeiro"
  ADD COLUMN "grupo_id" UUID,
  ADD COLUMN "parcela" INTEGER,
  ADD COLUMN "total_parcelas" INTEGER,
  ADD COLUMN "recorrencia_id" UUID;

--  As três colunas de parcela andam juntas ou não andam. Sem esta restrição,
--  uma linha com `parcela = 2` e `total_parcelas` nulo faria a tela exibir
--  "2/null" — e o banco teria aceitado calado um estado que não existe.
ALTER TABLE "lancamento_financeiro"
  ADD CONSTRAINT "lancamento_financeiro_parcela_completa_check"
  CHECK (
    (parcela IS NULL AND total_parcelas IS NULL AND grupo_id IS NULL)
    OR (parcela IS NOT NULL AND total_parcelas IS NOT NULL AND grupo_id IS NOT NULL)
  );

--  Parcela 0 de 3, ou 4 de 3, são erros de quem gera — e o banco é o único
--  lugar onde a checagem não pode ser esquecida.
ALTER TABLE "lancamento_financeiro"
  ADD CONSTRAINT "lancamento_financeiro_parcela_faixa_check"
  CHECK (
    parcela IS NULL
    OR (parcela >= 1 AND total_parcelas >= 2 AND parcela <= total_parcelas)
  );

CREATE INDEX "lancamento_financeiro_tenant_id_grupo_id_idx"
  ON "lancamento_financeiro" ("tenant_id", "grupo_id");

CREATE INDEX "lancamento_financeiro_tenant_id_recorrencia_id_idx"
  ON "lancamento_financeiro" ("tenant_id", "recorrencia_id");

-- ----------------------------------------------------------------------------
--  Recorrência: a tabela de moldes
-- ----------------------------------------------------------------------------

CREATE TABLE "lancamento_recorrente" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "tenant_id" UUID NOT NULL,

  "tipo" "tipo_lancamento" NOT NULL,
  "natureza" "natureza_lancamento" NOT NULL DEFAULT 'empresa',
  "descricao" VARCHAR(180) NOT NULL,
  "valor" DECIMAL(14,2) NOT NULL,

  "periodicidade" "periodicidade" NOT NULL,

  -- A primeira ocorrência. NUNCA muda: é a âncora do ciclo, e é dela que sai o
  -- dia do vencimento de todas as seguintes.
  "inicio" DATE NOT NULL,

  -- Quantas ocorrências já foram geradas. É o cursor — um contador não pode
  -- derivar como uma data pode.
  "ocorrencias" INTEGER NOT NULL DEFAULT 0,

  -- Quando a próxima vence. Derivada de `inicio` + `ocorrencias`; existe como
  -- coluna para o agendador procurar e a tela ordenar sem recalcular.
  "proxima_em" DATE NOT NULL,

  -- Até quando repetir. Nulo é "até alguém desligar".
  "fim" DATE,

  -- Desligar em vez de apagar preserva o vínculo dos lançamentos já gerados.
  "ativo" BOOLEAN NOT NULL DEFAULT true,

  "categoria_id" UUID,
  "servico_id" UUID,
  "cliente_id" UUID,

  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "lancamento_recorrente_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "lancamento_recorrente_valor_check" CHECK ("valor" > 0),
  CONSTRAINT "lancamento_recorrente_ocorrencias_check" CHECK ("ocorrencias" >= 0),
  -- Um fim anterior ao início é um molde que nunca produz nada.
  CONSTRAINT "lancamento_recorrente_fim_check" CHECK ("fim" IS NULL OR "fim" >= "inicio")
);

ALTER TABLE "lancamento_recorrente"
  ADD CONSTRAINT "lancamento_recorrente_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

--  `SET NULL` como no lançamento: apagar uma categoria não deve levar o molde
--  embora — ele continua válido, só sem classificação.
ALTER TABLE "lancamento_recorrente"
  ADD CONSTRAINT "lancamento_recorrente_categoria_id_fkey"
  FOREIGN KEY ("categoria_id") REFERENCES "categoria_financeira"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "lancamento_recorrente"
  ADD CONSTRAINT "lancamento_recorrente_servico_id_fkey"
  FOREIGN KEY ("servico_id") REFERENCES "servico"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "lancamento_recorrente"
  ADD CONSTRAINT "lancamento_recorrente_cliente_id_fkey"
  FOREIGN KEY ("cliente_id") REFERENCES "cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "lancamento_financeiro"
  ADD CONSTRAINT "lancamento_financeiro_recorrencia_id_fkey"
  FOREIGN KEY ("recorrencia_id") REFERENCES "lancamento_recorrente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "lancamento_recorrente_tenant_id_proxima_em_idx"
  ON "lancamento_recorrente" ("tenant_id", "proxima_em");

-- ----------------------------------------------------------------------------
--  Índice da varredura global
-- ----------------------------------------------------------------------------
--
--  O índice acima serve à tela, que sempre sabe a empresa. O agendador
--  justamente não sabe: ele procura o que está vencendo em **todas** as
--  empresas de uma vez. Sem este índice, cada passagem varreria a tabela.

CREATE INDEX "lancamento_recorrente_ativo_proxima_em_idx"
  ON "lancamento_recorrente" ("ativo", "proxima_em");

-- ----------------------------------------------------------------------------
--  Isolamento
-- ----------------------------------------------------------------------------

ALTER TABLE "lancamento_recorrente" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lancamento_recorrente" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "lancamento_recorrente"
  FOR ALL
  USING ("tenant_id" = app_current_tenant_id())
  WITH CHECK ("tenant_id" = app_current_tenant_id());

-- ----------------------------------------------------------------------------
--  Política de leitura sem contexto, para a varredura
-- ----------------------------------------------------------------------------
--
--  Mesmo problema de partida da varredura de lembretes (ver
--  `20260831120000_lembrete_varredura`): o agendador roda sem ninguém logado,
--  e sem `app.current_tenant_id` a política de isolamento não devolve linha
--  nenhuma. A tabela `tenant` também está sob RLS, então nem dá para percorrer
--  empresa por empresa.
--
--  A política abaixo libera **apenas SELECT**, **apenas sem contexto** e
--  **apenas nos moldes ativos e já no prazo de geração**. O `current_date + 45`
--  é folgado de propósito em relação à antecedência que a aplicação usa: a
--  política é uma cerca, não a regra de negócio, e apertá-la até o limite faria
--  uma mudança de constante na aplicação exigir migration.
--
--  O QUE ISSO EXPÕE, E POR QUE É ACEITÁVEL
--
--  Enquanto não há tenant no contexto, os moldes ativos e próximos do
--  vencimento ficam legíveis — incluindo `descricao` e `valor`. O alcance:
--
--  - Não vale para usuário autenticado. Com contexto definido,
--    `app_current_tenant_id() IS NULL` é falso e sobra só o isolamento:
--    ninguém logado passa a ver molde de outra empresa.
--  - Não alcança molde desligado nem distante. Recorrência inativa, encerrada
--    ou com vencimento a mais de 45 dias fica fora do `USING`.
--  - Não expõe dado pessoal. `cliente_id` sozinho não leva a nada: a tabela
--    `cliente` segue sob isolamento integral.
--  - Gravação segue isolada. A política é `FOR SELECT`; gerar o lançamento e
--    avançar o cursor continuam exigindo contexto, e o agendador o define a
--    partir do `tenant_id` antes de tocar em qualquer dado.
--
--  A alternativa seria o agendador usar a conexão administrativa, com
--  BYPASSRLS. Menos código, mas colocaria no agendador uma conexão que ignora
--  o isolamento inteiro — qualquer bug ali cruzaria empresas em vez de esbarrar
--  no banco.

CREATE POLICY recorrencia_varredura ON "lancamento_recorrente"
  FOR SELECT
  USING (
    app_current_tenant_id() IS NULL
    AND "ativo" = true
    AND "proxima_em" <= (current_date + 45)
  );
