-- ============================================================
-- CORRECAO DE PERMISSOES - permissoes para service_role e authenticated
-- Executar no Supabase SQL Editor ANTES de usar a aplicacao
-- ============================================================
-- Fase 2.4: `anon` foi removido daqui de proposito. Nenhum codigo do app
-- consulta tabela com anon (so Supabase Auth, que nao depende de GRANT de
-- tabela) e a RLS ja bloqueia anon com policies USING (false). Ver
-- 20261002000001_revoke_anon_grants.sql, que tambem revoga o que a versao
-- antiga deste arquivo ja havia concedido no banco vivo.
-- ============================================================

-- Conceder acesso total as tabelas criadas pela migration.
-- Guarda (Fase 2.5): num banco limpo nao existem as tabelas
-- Portuguese (especialidades_legacy etc.) nem `doctors` (renomeada
-- para doctors_legacy pela 003 antes desta migration rodar) — o
-- grant e pulado com NOTICE em vez de abortar o script.
DO $$
DECLARE
  t text;
  tables_to_grant text[] := ARRAY[
    'patients', 'professionals', 'profiles', 'clinic_members',
    'subscriptions', 'usage', 'units', 'medical_records', 'admin_profiles',
    'clinics', 'specialties', 'doctors', 'doctor_schedule', 'appointments',
    'users', 'conversations', 'messages', 'notifications', 'reminders',
    'clinic_alerts', 'billing_events', 'admins',
    'especialidades_legacy', 'medicos_legacy', 'pacientes_legacy',
    'consultas_legacy', 'doctors_legacy'
  ];
BEGIN
  FOREACH t IN ARRAY tables_to_grant LOOP
    IF to_regclass(format('public.%I', t)) IS NOT NULL THEN
      EXECUTE format('GRANT ALL ON %I TO service_role, authenticated', t);
    ELSE
      RAISE NOTICE 'GRANT pulado (tabela inexistente): %', t;
    END IF;
  END LOOP;
END $$;

-- Conceder acesso sequences (para INSERT com BIGSERIAL)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role, authenticated;
