-- ============================================================
-- CORRECAO DE PERMISSOES —授予权限 para service_role
-- Executar no Supabase SQL Editor ANTES de usar a aplicacao
-- ============================================================

-- Conceder acesso total as tabelas criadas pela migration
GRANT ALL ON patients TO service_role, authenticated, anon;
GRANT ALL ON professionals TO service_role, authenticated, anon;
GRANT ALL ON profiles TO service_role, authenticated, anon;
GRANT ALL ON clinic_members TO service_role, authenticated, anon;
GRANT ALL ON subscriptions TO service_role, authenticated, anon;
GRANT ALL ON usage TO service_role, authenticated, anon;
GRANT ALL ON units TO service_role, authenticated, anon;
GRANT ALL ON medical_records TO service_role, authenticated, anon;
GRANT ALL ON admin_profiles TO service_role, authenticated, anon;

-- Conceder acesso as tabelas existentes que podem ter perdido permissao
GRANT ALL ON clinics TO service_role, authenticated, anon;
GRANT ALL ON specialties TO service_role, authenticated, anon;
GRANT ALL ON doctors TO service_role, authenticated, anon;
GRANT ALL ON doctor_schedule TO service_role, authenticated, anon;
GRANT ALL ON appointments TO service_role, authenticated, anon;
GRANT ALL ON users TO service_role, authenticated, anon;
GRANT ALL ON conversations TO service_role, authenticated, anon;
GRANT ALL ON messages TO service_role, authenticated, anon;
GRANT ALL ON notifications TO service_role, authenticated, anon;
GRANT ALL ON reminders TO service_role, authenticated, anon;
GRANT ALL ON clinic_alerts TO service_role, authenticated, anon;
GRANT ALL ON billing_events TO service_role, authenticated, anon;
GRANT ALL ON admins TO service_role, authenticated, anon;

-- Conceder acesso as tabelas legacy
GRANT ALL ON especialidades_legacy TO service_role, authenticated, anon;
GRANT ALL ON medicos_legacy TO service_role, authenticated, anon;
GRANT ALL ON pacientes_legacy TO service_role, authenticated, anon;
GRANT ALL ON consultas_legacy TO service_role, authenticated, anon;
GRANT ALL ON doctors_legacy TO service_role, authenticated, anon;

-- Conceder acesso sequences (para INSERT com BIGSERIAL)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role, authenticated, anon;
