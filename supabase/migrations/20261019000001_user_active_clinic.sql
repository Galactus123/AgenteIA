-- ============================================================
-- 20261019000001_user_active_clinic.sql — Fase 1 Multi-Clínica
-- ------------------------------------------------------------
-- Guarda, no servidor, a clínica ativa escolhida por cada
-- utilizador. O cookie `sd_active_clinic` (httpOnly) vale por
-- dispositivo/navegador; esta tabela é a preferência PERSISTENTE
-- (troca entre dispositivos) lida pela resolução de clínica em
-- src/lib/api-auth.ts (resolveClinicIdByUserId).
--
-- Regra de segurança: a linha NÃO autoriza nada por si só. Todo o
-- código valida a preferência contra clinic_members (vínculo ativo
-- do próprio user_id) antes de a usar — um apontamento inválido
-- (vínculo removido, conta de outro utilizador) é ignorado e cai
-- no fallback (menor clinic_id ativo), nunca em dado de outro
-- tenant. O cookie segue a mesma validação ao ser lido.
--
-- Segurança (padrão trial_leads/audit_logs):
--   * RLS habilitado SEM policies = deny-all para anon e
--     authenticated (leitura/gravação só pelo service_role);
--   * REVOKE explícito de anon/authenticated + GRANT a service_role
--     (20261005000002 mostrou que os default privileges deste
--     projeto NÃO cobrem tabelas novas);
--   * PK em user_id: uma linha por utilizador — a troca de clínica
--     é um UPSERT (onConflict: "user_id") em
--     src/app/api/clinics/active/route.ts.
-- Idempotente: reexecutável (IF NOT EXISTS em tudo).
-- ============================================================

CREATE TABLE IF NOT EXISTS user_active_clinic (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  clinic_id BIGINT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Conferências/limpezas: saber quais clínicas têm utilizador ativo
-- (e apagar a escolha quando a clínica é removida já vem do CASCADE).
CREATE INDEX IF NOT EXISTS idx_user_active_clinic_clinic_id
  ON user_active_clinic (clinic_id);

COMMENT ON TABLE user_active_clinic IS
  'Clínica ativa escolhida por cada utilizador (Fase 1 multi-clínica). A preferência só é usada após validação do vínculo em clinic_members.';

ALTER TABLE user_active_clinic ENABLE ROW LEVEL SECURITY;
-- Sem CREATE POLICY: deny-all para anon e authenticated.

REVOKE ALL ON public.user_active_clinic FROM anon;
REVOKE ALL ON public.user_active_clinic FROM authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_active_clinic TO service_role;

-- ============================================================
-- VERIFICAÇÃO — devem voltar vazias / falhar com exceção
-- ============================================================
-- (1) nenhuma policy exposta (deny-all correcto):
SELECT c.relname AS tabela, p.polname
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_policy p ON p.polrelid = c.oid
WHERE n.nspname = 'public' AND c.relname = 'user_active_clinic';

-- (2) nenhum acesso a anon/authenticated:
SELECT c.relname
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'user_active_clinic'
  AND CASE
        WHEN c.relkind = 'r' THEN has_table_privilege('anon', c.oid, 'SELECT')
                               OR has_table_privilege('authenticated', c.oid, 'SELECT')
        ELSE false
      END;

-- (3) service_role consegue ler e escrever (falha com exceção se não):
DO $$
BEGIN
  IF NOT has_table_privilege('service_role', 'public.user_active_clinic', 'SELECT')
     OR NOT has_table_privilege('service_role', 'public.user_active_clinic', 'INSERT')
     OR NOT has_table_privilege('service_role', 'public.user_active_clinic', 'UPDATE') THEN
    RAISE EXCEPTION 'service_role sem grant em user_active_clinic';
  END IF;
  RAISE NOTICE 'user_active_clinic: deny-all para anon/authenticated, service_role com CRUD';
END $$;
