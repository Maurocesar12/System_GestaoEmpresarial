-- ============================================================================
--  Administração de planos pelo SQL — duas funções de apoio
--
--  POR QUE ISSO EXISTE
--
--  Trocar o plano de uma empresa por um `UPDATE` direto no editor do Neon não
--  funciona, e falha do pior jeito: em silêncio. A política `tenant_isolation`
--  compara `id` com `app_current_tenant_id()`, que é lido de uma variável da
--  **sessão** do banco. O editor do Neon roda cada comando numa conexão HTTP
--  sem estado, então um `set_config` executado antes morre antes do `UPDATE` —
--  que não encontra a linha e devolve `UPDATE 0`, sem erro nenhum.
--
--  Dentro de uma função é diferente: a chamada inteira é um comando só, logo
--  uma transação só. O contexto definido no começo vale até o fim.
--
--  O outro problema que estas funções resolvem é humano. Os ids são UUID v7,
--  que começam com o instante de criação: duas empresas cadastradas no mesmo
--  minuto têm ids quase idênticos (`01a073ac-49ac-…` e `01a073ac-49a1-…`), e
--  copiar o errado é fácil. Aqui a empresa é identificada pelo **e-mail de
--  quem usa o sistema**, que ninguém confunde.
--
--  SEGURANÇA
--
--  Nenhuma política é desligada e nada de `SECURITY DEFINER`: as funções rodam
--  com os privilégios de quem chama (`SECURITY INVOKER`, o padrão). Elas não
--  concedem poder novo a ninguém — quem tem a credencial do banco já podia
--  fazer o mesmo `set_config` + `UPDATE` à mão. O que elas fazem é tornar isso
--  correto na primeira tentativa.
--
--  A ordem das leituras é proposital: `usuario` é consultada **antes** de o
--  contexto existir, porque é a política `usuario_login` que libera essa
--  leitura, e ela só vale quando `app_current_tenant_id()` é nulo.
-- ============================================================================

-- ----------------------------------------------------------------------------
--  Listar: qual empresa está em qual plano
-- ----------------------------------------------------------------------------
--
--  Uso:  SELECT * FROM listar_empresas();

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

-- ----------------------------------------------------------------------------
--  Trocar: define o plano da empresa a que o e-mail pertence
-- ----------------------------------------------------------------------------
--
--  Uso:  SELECT definir_plano('mauro@exemplo.com', 'essencial');

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
