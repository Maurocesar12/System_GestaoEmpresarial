-- ============================================================================
--  Registrar pagamento pelo SQL — a função que faltava
--
--  POR QUE ISSO EXISTE
--
--  Quando o teste termina, o sistema pede pagamento. Quem libera o acesso de
--  volta é a coluna `tenant.ultimo_pagamento_em`: `calcularAcesso`
--  (`@gestao/shared-types`) conta um mês a partir dela, e esse prazo vence o
--  `trial_termina_em`. Só que **nada no código escreve essa coluna** — a
--  integração de cobrança ainda não a grava. Hoje ela só pode ser definida
--  direto no banco.
--
--  E um `UPDATE` direto no editor do Neon não funciona, pelo mesmo motivo já
--  documentado em `20260917160000_admin_planos`: a política `tenant_isolation`
--  compara `id` com `app_current_tenant_id()`, lido de uma variável da
--  **sessão**. O editor roda cada comando numa conexão HTTP sem estado, então
--  um `set_config` anterior morre antes do `UPDATE` — que não acha a linha e
--  responde `UPDATE 0`, sem erro. A pessoa sai achando que liberou o acesso.
--
--  Dentro de uma função a chamada inteira é um comando só, logo uma transação
--  só, e o contexto vale até o fim.
--
--  SEGURANÇA
--
--  `SECURITY INVOKER` (o padrão): roda com os privilégios de quem chama e não
--  concede poder novo a ninguém. Nenhuma política é desligada.
--
--  A leitura de `usuario` vem **antes** de o contexto existir, porque é a
--  política `usuario_login` que a libera, e ela só vale com contexto nulo.
-- ============================================================================

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
