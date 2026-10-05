-- ============================================================
-- 20261005000002_grants_audit_outbox.sql — Fase 7 (achado 05/10/2026)
-- ------------------------------------------------------------
-- Varredura do PostgREST de produção (28 tabelas expostas): 26 leem
-- normalmente, mas `audit_logs` e `outbox` respondem 42501
-- ("permission denied for table ...") para o service_role — o
-- default privileges deste projeto de Supabase não cobre essas duas
-- tabelas novas. Efeito em produção:
--   * audit_logs: `recordAudit` é best-effort → trilha de auditoria
--     gravando nada em silêncio;
--   * outbox: o cron /api/outbox/run falha com 42501.
-- As demais tabelas já têm grant (criadas antes / defaults antigos).
--
-- Idempotente: GRANT é reexecutável; o DO abaixo só confere o estado.
-- ============================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_logs TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.audit_logs_id_seq TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.outbox TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.outbox_id_seq TO service_role;

DO $$
BEGIN
  IF NOT has_table_privilege('service_role', 'public.audit_logs', 'SELECT')
     OR NOT has_table_privilege('service_role', 'public.audit_logs', 'INSERT')
     OR NOT has_table_privilege('service_role', 'public.outbox', 'SELECT')
     OR NOT has_table_privilege('service_role', 'public.outbox', 'INSERT') THEN
    RAISE EXCEPTION 'service_role ainda sem grant em audit_logs/outbox';
  END IF;
  RAISE NOTICE 'grants: service_role com SELECT/INSERT em audit_logs e outbox';
END $$;
