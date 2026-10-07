-- ============================================================
-- 20261007000001_trial_leads.sql — Funil de aquisição (GO-1)
-- ------------------------------------------------------------
-- Leads do formulário público /teste-gratis, com atribuição de
-- origem (plan/utm_source) vinda dos CTAs de /precos. Antes desta
-- tabela o formulário lia os campos e descartava-os no browser:
-- cada lead morria silenciosamente.
--
-- Segurança (padrão outbox/audit_logs):
--   * RLS habilitado SEM policies = deny-all para anon e
--     authenticated (apenas o service_role grava e lê);
--   * REVOKE explícito de anon/authenticated + GRANT a service_role:
--     20261005000002 mostrou que o default privileges deste projeto
--     NÃO cobre tabelas novas (audit_logs/outbox ficaram inacessíveis
--     ao service_role em produção);
--   * dedupe por e-mail: reenvio (retry de rede, duplo clique) não
--     cria linha nova — o erro 23505 é tratado como sucesso na rota.
-- Idempotente: reexecutável (IF NOT EXISTS em tudo).
-- ============================================================

CREATE TABLE IF NOT EXISTS trial_leads (
  id BIGSERIAL PRIMARY KEY,
  clinic_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  -- 'br' | 'mz': países atendidos pelo formulário.
  country TEXT NOT NULL DEFAULT 'br'
    CHECK (country IN ('br', 'mz')),
  specialty TEXT,
  -- E-mail é opcional no formulário.
  email TEXT,
  -- Atribuição de venda: plano clicado em /precos (best-effort).
  plan TEXT
    CHECK (plan IS NULL OR plan IN ('start', 'pro', 'business', 'enterprise')),
  source TEXT NOT NULL DEFAULT 'teste-gratis',
  utm_source TEXT,
  -- Fluxo comercial: new → contacted → converted | archived.
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'contacted', 'converted', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lista comercial em ordem cronológica inversa.
CREATE INDEX IF NOT EXISTS idx_trial_leads_created_at
  ON trial_leads (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_trial_leads_status
  ON trial_leads (status)
  WHERE status = 'new';

-- Mesmo e-mail = mesmo lead. Parcial porque o e-mail é opcional.
CREATE UNIQUE INDEX IF NOT EXISTS uq_trial_leads_email
  ON trial_leads (lower(email))
  WHERE email IS NOT NULL;

ALTER TABLE trial_leads ENABLE ROW LEVEL SECURITY;
-- Sem CREATE POLICY: deny-all para anon e authenticated.

REVOKE ALL ON public.trial_leads FROM anon;
REVOKE ALL ON public.trial_leads FROM authenticated;
REVOKE ALL ON SEQUENCE public.trial_leads_id_seq FROM anon;
REVOKE ALL ON SEQUENCE public.trial_leads_id_seq FROM authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trial_leads TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.trial_leads_id_seq TO service_role;

-- ============================================================
-- VERIFICAÇÃO — devem voltar vazias
-- ============================================================
-- (1) nenhuma policy exposta (deny-all correcto):
SELECT c.relname AS tabela, p.polname
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_policy p ON p.polrelid = c.oid
WHERE n.nspname = 'public' AND c.relname = 'trial_leads';

-- (2) nenhum acesso a anon/authenticated:
SELECT c.relname
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'trial_leads'
  AND CASE
        WHEN c.relkind = 'r' THEN has_table_privilege('anon', c.oid, 'SELECT')
                               OR has_table_privilege('authenticated', c.oid, 'SELECT')
        ELSE false
      END;

-- (3) service_role consegue inserir (falha com exceção se não):
DO $$
BEGIN
  IF NOT has_table_privilege('service_role', 'public.trial_leads', 'INSERT') THEN
    RAISE EXCEPTION 'service_role sem INSERT em trial_leads';
  END IF;
  RAISE NOTICE 'trial_leads: deny-all para anon/authenticated, service_role com CRUD';
END $$;
