-- ============================================================================
--  Políticas sem contexto passam a exigir declaração explícita
--
--  O PROBLEMA
--
--  Quatro políticas liberavam leitura sempre que não havia empresa no
--  contexto (`app_current_tenant_id() IS NULL`):
--
--    usuario_login          → a tabela `usuario` INTEIRA, com hash de senha
--    lembrete_varredura     → todos os lembretes pendentes
--    recorrencia_varredura  → os moldes de recorrência a vencer, com valores
--    tenant_expurgo         → as empresas canceladas
--
--  Cada uma foi pensada para um único chamador (o login, a varredura de
--  lembretes...). Mas "sem contexto" não identifica chamador nenhum: qualquer
--  consulta feita fora de `comTenant()` — uma rota nova esquecida, um bug —
--  caía na mesma política e enxergava os dados de todas as empresas.
--
--  A CORREÇÃO
--
--  Cada política agora só vale quando quem consulta **declara** para que veio,
--  numa variável de sessão definida dentro da própria transação:
--
--    app.login_email = '<e-mail>'   → só a linha daquele e-mail
--    app.varredura   = 'lembretes' | 'recorrencias' | 'expurgo' | 'contas'
--
--  Uma consulta sem contexto e sem declaração não vê nada. É falha fechada, a
--  mesma regra das demais tabelas.
--
--  A declaração não é um segredo — o próprio papel da aplicação pode
--  defini-la. Ela não protege contra quem já executa SQL arbitrário no banco
--  (esse já teria o resto). Protege contra o caso real: código da aplicação
--  que esqueceu o contexto. Esse código não declara nada, e não vê nada.
--
--  Por que não SECURITY DEFINER: uma função com os privilégios do dono só
--  funcionaria enquanto o dono tivesse BYPASSRLS, uma propriedade do ambiente
--  (Neon tem, um CI pode não ter). As políticas valem em qualquer papel.
-- ============================================================================

-- ----------------------------------------------------------------------------
--  usuario: login, recuperação de senha e e-mail duplicado
-- ----------------------------------------------------------------------------
--  `lower()` nos dois lados: os scripts de administração procuram pelo e-mail
--  digitado à mão, e a aplicação grava o e-mail já normalizado.

DROP POLICY IF EXISTS usuario_login ON "usuario";

CREATE POLICY usuario_login ON "usuario"
  FOR SELECT
  USING (
    app_current_tenant_id() IS NULL
    AND lower("email") = lower(NULLIF(current_setting('app.login_email', true), ''))
  );

-- Listagem de contas para os scripts de administração (`pnpm plano`,
-- `pnpm acesso`, `pnpm diagnostico`) e para `listar_empresas()`. A aplicação
-- nunca declara esta varredura.
DROP POLICY IF EXISTS usuario_listagem_admin ON "usuario";

CREATE POLICY usuario_listagem_admin ON "usuario"
  FOR SELECT
  USING (
    app_current_tenant_id() IS NULL
    AND current_setting('app.varredura', true) = 'contas'
  );

-- ----------------------------------------------------------------------------
--  Varreduras dos agendadores
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS lembrete_varredura ON "lembrete_follow_up";

CREATE POLICY lembrete_varredura ON "lembrete_follow_up"
  FOR SELECT
  USING (
    app_current_tenant_id() IS NULL
    AND current_setting('app.varredura', true) = 'lembretes'
    AND status = 'pendente'
  );

DROP POLICY IF EXISTS recorrencia_varredura ON "lancamento_recorrente";

CREATE POLICY recorrencia_varredura ON "lancamento_recorrente"
  FOR SELECT
  USING (
    app_current_tenant_id() IS NULL
    AND current_setting('app.varredura', true) = 'recorrencias'
    AND "ativo" = true
    AND "proxima_em" <= (current_date + 45)
  );

DROP POLICY IF EXISTS tenant_expurgo ON "tenant";

CREATE POLICY tenant_expurgo ON "tenant"
  FOR SELECT
  USING (
    app_current_tenant_id() IS NULL
    AND current_setting('app.varredura', true) = 'expurgo'
    AND status = 'cancelado'
  );

-- ----------------------------------------------------------------------------
--  Funções de administração (editor SQL do Neon)
-- ----------------------------------------------------------------------------
--  Os corpos abaixo são os das migrations `20260917160000_admin_planos` e
--  `20260922120000_admin_pagamento`, sem nenhuma mudança de regra. A única
--  linha nova em cada uma é a declaração logo depois do `BEGIN`: sem ela, a
--  leitura de `usuario` antes do contexto não encontraria mais ninguém.

CREATE OR REPLACE FUNCTION listar_empresas()
RETURNS TABLE (
  tenant_id uuid,
  empresa   text,
  plano     text,
  status    text,
  email     text,
  clientes  bigint
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_ids uuid[];
  v_id  uuid;
BEGIN
  -- Declara a listagem: é o que a política `usuario_listagem_admin` exige.
  PERFORM set_config('app.varredura', 'contas', true);

  -- Os ids são coletados num array, e não iterados direto de um cursor sobre
  -- `usuario`. O motivo é sutil: o laço define o contexto a cada volta, e um
  -- cursor ainda aberto sobre `usuario` passaria a ser filtrado por
  -- `tenant_isolation` a partir da segunda leitura, devolvendo nada.
  SELECT array_agg(DISTINCT u.tenant_id) INTO v_ids FROM usuario u;

  FOREACH v_id IN ARRAY coalesce(v_ids, '{}'::uuid[]) LOOP
    PERFORM set_config('app.current_tenant_id', v_id::text, true);

    RETURN QUERY
      SELECT t.id,
             t.nome::text,
             p.slug::text,
             t.status::text,
             (SELECT u.email::text
                FROM usuario u
               WHERE u.tenant_id = t.id AND u.papel = 'admin'
               ORDER BY u.criado_em
               LIMIT 1),
             (SELECT count(*) FROM cliente c WHERE c.tenant_id = t.id)
        FROM tenant t
        JOIN plano p ON p.id = t.plano_id
       WHERE t.id = v_id;
  END LOOP;

  -- Devolve a sessão ao estado sem contexto. Sem isto, o restante da transação
  -- herdaria o tenant da última volta do laço.
  PERFORM set_config('app.current_tenant_id', '', true);
END
$$;

COMMENT ON FUNCTION listar_empresas() IS
  'Empresas, plano atual e e-mail do administrador. Uso: SELECT * FROM listar_empresas();';


CREATE OR REPLACE FUNCTION definir_plano(p_email text, p_slug text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_tenant_id uuid;
  v_plano_id  uuid;
  v_empresa   text;
  v_antes     text;
  v_slug      text := btrim(p_slug);
BEGIN
  -- Declara o e-mail procurado: é o que a política `usuario_login` exige.
  PERFORM set_config('app.login_email', btrim(p_email), true);

  -- Antes do contexto: é a política `usuario_login` que permite ler `usuario`,
  -- e ela exige contexto nulo.
  SELECT u.tenant_id INTO v_tenant_id
    FROM usuario u
   WHERE lower(u.email) = lower(btrim(p_email));

  IF v_tenant_id IS NULL THEN
    RETURN format('Nenhum usuário com o e-mail %L. Veja SELECT * FROM listar_empresas();',
                  p_email);
  END IF;

  SELECT p.id INTO v_plano_id FROM plano p WHERE p.slug = v_slug;

  IF v_plano_id IS NULL THEN
    RETURN format('Plano %L não existe. Disponíveis: %s',
                  v_slug,
                  (SELECT string_agg(p.slug, ', ' ORDER BY p.nivel) FROM plano p));
  END IF;

  -- Daqui para frente a empresa é visível, e `tenant_isolation` aprova
  -- exatamente esta linha. O terceiro argumento `true` limita o efeito a esta
  -- transação — que é a própria chamada da função.
  PERFORM set_config('app.current_tenant_id', v_tenant_id::text, true);

  SELECT t.nome::text, p.slug::text INTO v_empresa, v_antes
    FROM tenant t
    JOIN plano p ON p.id = t.plano_id
   WHERE t.id = v_tenant_id;

  IF v_empresa IS NULL THEN
    -- Não deveria acontecer: o contexto acabou de ser definido com este id.
    RETURN 'Empresa não encontrada mesmo com o contexto definido. Confira as políticas de RLS da tabela tenant.';
  END IF;

  IF v_antes = v_slug THEN
    RETURN format('%s já estava no plano %s. Nada alterado.', v_empresa, v_slug);
  END IF;

  UPDATE tenant SET plano_id = v_plano_id WHERE id = v_tenant_id;

  RETURN format('%s: %s -> %s', v_empresa, v_antes, v_slug);
END
$$;

COMMENT ON FUNCTION definir_plano(text, text) IS
  'Troca o plano da empresa do usuário informado. Uso: SELECT definir_plano(''email'', ''essencial'');';

CREATE OR REPLACE FUNCTION registrar_pagamento(
  p_email text,
  p_data  date DEFAULT current_date
)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_tenant_id uuid;
  v_empresa   text;
  v_status    text;
  v_antes     date;
  v_ate       date;
BEGIN
  -- Declara o e-mail procurado: é o que a política `usuario_login` exige.
  PERFORM set_config('app.login_email', btrim(p_email), true);

  SELECT u.tenant_id INTO v_tenant_id
    FROM usuario u
   WHERE lower(u.email) = lower(btrim(p_email));

  IF v_tenant_id IS NULL THEN
    RETURN format('Nenhum usuário com o e-mail %L. Veja SELECT * FROM listar_empresas();',
                  p_email);
  END IF;

  -- Daqui para frente a empresa é visível, e `tenant_isolation` aprova
  -- exatamente esta linha. O terceiro argumento `true` limita o efeito a esta
  -- transação — que é a própria chamada da função.
  PERFORM set_config('app.current_tenant_id', v_tenant_id::text, true);

  SELECT t.nome::text, t.status::text, t.ultimo_pagamento_em
    INTO v_empresa, v_status, v_antes
    FROM tenant t
   WHERE t.id = v_tenant_id;

  IF v_empresa IS NULL THEN
    RETURN 'Empresa não encontrada mesmo com o contexto definido. Confira as políticas de RLS da tabela tenant.';
  END IF;

  -- Conta cancelada não volta por aqui. `calcularAcesso` recusa `cancelado`
  -- antes de olhar qualquer data, então gravar o pagamento não liberaria nada
  -- e ainda daria a impressão de ter resolvido. Reativar é outra decisão:
  -- a conta pode estar em exclusão pela política de retenção (LGPD).
  IF v_status = 'cancelado' THEN
    RETURN format('%s está cancelada. Registrar pagamento não libera o acesso — reative a conta antes.',
                  v_empresa);
  END IF;

  -- O mesmo mês de `somarUmMes`: o Postgres também trava no último dia do mês
  -- alvo, então 31/01 + 1 mês dá 28/02 nos dois lados.
  v_ate := p_data + interval '1 month';

  UPDATE tenant
     SET ultimo_pagamento_em = p_data,
         -- Quem pagou deixa de estar em teste. O status não bloqueia acesso
         -- (só `cancelado` bloqueia), mas deixá-lo em `trial` depois de um
         -- pagamento faz a tela de plano contar a história errada.
         status = 'ativo'
   WHERE id = v_tenant_id;

  RETURN format('%s: pagamento em %s (antes: %s). Acesso liberado até %s.',
                v_empresa,
                to_char(p_data, 'DD/MM/YYYY'),
                coalesce(to_char(v_antes, 'DD/MM/YYYY'), 'nenhum'),
                to_char(v_ate, 'DD/MM/YYYY'));
END
$$;

COMMENT ON FUNCTION registrar_pagamento(text, date) IS
  'Registra o pagamento da empresa do usuário e libera um mês de acesso. Uso: SELECT registrar_pagamento(''email'');';
