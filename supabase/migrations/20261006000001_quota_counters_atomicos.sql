-- ============================================================
-- 20261006000001_quota_counters_atomicos.sql - quotas por plano
-- ------------------------------------------------------------
-- Contadores de quota deixam de ser "read-modify-write" na app:
-- duas mensagens simultaneas liam o mesmo total e uma perdia a
-- contagem. Aqui o Postgres soma em um unico UPDATE, atomico.
--
-- Funcoes (chamadas via supabaseAdmin.rpc):
--   * increment_clinic_token_usage(clinic, amount) -> novo total
--     (clinics.current_token_usage, cota de tokens da IA).
--   * increment_usage_counters(clinic, period, wa, ai) -> linha
--     (usage: conversas WhatsApp + interacoes IA do periodo,
--     upsert no indice unico clinic_id+period).
--
-- Seguranca:
--   * SECURITY DEFINER + SET search_path = public (sem dependencia
--     de search_path do chamador).
--   * EXECUTE so para service_role: anon/authenticated nao podem
--     incrementar contadores de terceiros pela API PostgREST.
--   * A app trata o caso da funcao ainda nao existir (banco nao
--     migrado) e cai no caminho legado - logo esta migration e
--     obrigatoria antes de confiar na contagem.
--
-- Idempotente: CREATE OR REPLACE + grants reexecutaveis.
-- ============================================================

CREATE OR REPLACE FUNCTION public.increment_clinic_token_usage(
  p_clinic_id BIGINT,
  p_amount INTEGER
) RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usage BIGINT;
BEGIN
  UPDATE clinics
     SET current_token_usage =
           current_token_usage + GREATEST(COALESCE(p_amount, 0), 0)
   WHERE id = p_clinic_id
  RETURNING current_token_usage INTO v_usage;

  -- -1 = clinica inexistente: o chamador mantem o comportamento legado.
  RETURN COALESCE(v_usage, -1);
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_usage_counters(
  p_clinic_id BIGINT,
  p_period TEXT,
  p_whatsapp INTEGER,
  p_ai INTEGER
) RETURNS public.usage
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.usage;
BEGIN
  INSERT INTO public.usage AS u (
    clinic_id,
    period,
    whatsapp_conversations,
    ai_interactions,
    created_at,
    updated_at
  )
  VALUES (
    p_clinic_id,
    p_period,
    GREATEST(COALESCE(p_whatsapp, 0), 0),
    GREATEST(COALESCE(p_ai, 0), 0),
    now(),
    now()
  )
  ON CONFLICT (clinic_id, period) DO UPDATE
     SET whatsapp_conversations =
           u.whatsapp_conversations + EXCLUDED.whatsapp_conversations,
         ai_interactions =
           u.ai_interactions + EXCLUDED.ai_interactions,
         updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_clinic_token_usage(BIGINT, INTEGER)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.increment_usage_counters(BIGINT, TEXT, INTEGER, INTEGER)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.increment_clinic_token_usage(BIGINT, INTEGER)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_usage_counters(BIGINT, TEXT, INTEGER, INTEGER)
  TO service_role;
