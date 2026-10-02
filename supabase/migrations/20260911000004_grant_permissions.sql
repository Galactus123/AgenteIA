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

-- Conceder acesso total as tabelas criadas pela migration
GRANT ALL ON patients TO service_role, authenticated;
GRANT ALL ON professionals TO service_role, authenticated;
GRANT ALL ON profiles TO service_role, authenticated;
GRANT ALL ON clinic_members TO service_role, authenticated;
GRANT ALL ON subscriptions TO service_role, authenticated;
GRANT ALL ON usage TO service_role, authenticated;
GRANT ALL ON units TO service_role, authenticated;
GRANT ALL ON medical_records TO service_role, authenticated;
GRANT ALL ON admin_profiles TO service_role, authenticated;

-- Conceder acesso as tabelas existentes que podem ter perdido permissao
GRANT ALL ON clinics TO service_role, authenticated;
GRANT ALL ON specialties TO service_role, authenticated;
GRANT ALL ON doctors TO service_role, authenticated;
GRANT ALL ON doctor_schedule TO service_role, authenticated;
GRANT ALL ON appointments TO service_role, authenticated;
GRANT ALL ON users TO service_role, authenticated;
GRANT ALL ON conversations TO service_role, authenticated;
GRANT ALL ON messages TO service_role, authenticated;
GRANT ALL ON notifications TO service_role, authenticated;
GRANT ALL ON reminders TO service_role, authenticated;
GRANT ALL ON clinic_alerts TO service_role, authenticated;
GRANT ALL ON billing_events TO service_role, authenticated;
GRANT ALL ON admins TO service_role, authenticated;

-- Conceder acesso as tabelas legacy
GRANT ALL ON especialidades_legacy TO service_role, authenticated;
GRANT ALL ON medicos_legacy TO service_role, authenticated;
GRANT ALL ON pacientes_legacy TO service_role, authenticated;
GRANT ALL ON consultas_legacy TO service_role, authenticated;
GRANT ALL ON doctors_legacy TO service_role, authenticated;

-- Conceder acesso sequences (para INSERT com BIGSERIAL)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role, authenticated;
