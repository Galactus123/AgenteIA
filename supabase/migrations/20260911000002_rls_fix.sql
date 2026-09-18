-- ============================================================
-- SaudeSync — Migration 002: Seguranca Multi-Tenant via RLS
-- Versao: 20260911000002
-- Descricao: Habilita RLS, bloqueia anon key, protege dados.
-- ============================================================
--
-- ARQUITETURA DE AUTENTICACAO ATUAL:
--   - App usa autenticacao propria (cookies HMAC), NAO Supabase Auth.
--   - Backend usa supabaseAdmin (service_role) para acessar o banco.
--   - service_role BYPASSA RLS automaticamente.
--   - Frontend NAO consulta Supabase diretamente.
--   - Anon key NUNCA deve acessar dados privados.
--
-- POR QUE USAMOS USING (false):
--   - auth.uid() retorna NULL (nao usa Supabase Auth)
--   - current_setting('request.jwt.claims') retorna NULL (nao tem JWT)
--   - Qualquer policy usando essas funcoes seria equivalente a USING (false)
--   - USING (false) + REVOKE e a forma CORRETA e SEGURA de proteger
--     os dados quando o backend usa service_role
--
-- SERVICE_ROLE BYPASSA RLS:
--   - Documentado pelo Supabase: https://supabase.com/docs/guides/auth/row-level-security#built-in-roles
--   - Todas as queries do backend usam supabaseAdmin
--   - O backend funciona normalmente com RLS ativo
--
-- MIGRACAO FUTURA:
--   - Se o app migrar para Supabase Auth, as policies podem ser
--     atualizadas para usar auth.uid() e clinic_members
--   - Exemplo: USING (clinic_id = (
--     SELECT clinic_id FROM clinic_members
--     WHERE user_id = auth.uid() AND active = true
--   ))
-- ============================================================


-- ============================================================
-- FASE 1: Adicionar clinic_id nas tabelas que ainda nao tem
-- ============================================================

-- 1.1 admins
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admins' AND column_name = 'clinic_id'
  ) THEN
    ALTER TABLE admins ADD COLUMN clinic_id BIGINT REFERENCES clinics(id) DEFAULT 1;
    RAISE NOTICE 'admins: clinic_id adicionado';
  ELSE
    RAISE NOTICE 'admins: clinic_id ja existe';
  END IF;
END $$;

-- 1.2 doctors
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'doctors' AND column_name = 'clinic_id'
  ) THEN
    ALTER TABLE doctors ADD COLUMN clinic_id BIGINT REFERENCES clinics(id) DEFAULT 1;
    RAISE NOTICE 'doctors: clinic_id adicionado';
  ELSE
    RAISE NOTICE 'doctors: clinic_id ja existe';
  END IF;
END $$;

-- 1.3 specialties
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'specialties' AND column_name = 'clinic_id'
  ) THEN
    ALTER TABLE specialties ADD COLUMN clinic_id BIGINT REFERENCES clinics(id) DEFAULT 1;
    RAISE NOTICE 'specialties: clinic_id adicionado';
  ELSE
    RAISE NOTICE 'specialties: clinic_id ja existe';
  END IF;
END $$;

-- 1.4 conversations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'conversations' AND column_name = 'clinic_id'
  ) THEN
    ALTER TABLE conversations ADD COLUMN clinic_id BIGINT REFERENCES clinics(id) DEFAULT 1;
    RAISE NOTICE 'conversations: clinic_id adicionado';
  ELSE
    RAISE NOTICE 'conversations: clinic_id ja existe';
  END IF;
END $$;

-- 1.5 appointments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'appointments' AND column_name = 'clinic_id'
  ) THEN
    ALTER TABLE appointments ADD COLUMN clinic_id BIGINT REFERENCES clinics(id) DEFAULT 1;
    RAISE NOTICE 'appointments: clinic_id adicionado';
  ELSE
    RAISE NOTICE 'appointments: clinic_id ja existe';
  END IF;
END $$;

-- 1.6 notifications
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'clinic_id'
  ) THEN
    ALTER TABLE notifications ADD COLUMN clinic_id BIGINT REFERENCES clinics(id) DEFAULT 1;
    RAISE NOTICE 'notifications: clinic_id adicionado';
  ELSE
    RAISE NOTICE 'notifications: clinic_id ja existe';
  END IF;
END $$;

-- 1.7 users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'clinic_id'
  ) THEN
    ALTER TABLE users ADD COLUMN clinic_id BIGINT REFERENCES clinics(id) DEFAULT 1;
    RAISE NOTICE 'users: clinic_id adicionado';
  ELSE
    RAISE NOTICE 'users: clinic_id ja existe';
  END IF;
END $$;

-- 1.8 reminders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reminders' AND column_name = 'clinic_id'
  ) THEN
    ALTER TABLE reminders ADD COLUMN clinic_id BIGINT REFERENCES clinics(id) DEFAULT 1;
    RAISE NOTICE 'reminders: clinic_id adicionado';
  ELSE
    RAISE NOTICE 'reminders: clinic_id ja existe';
  END IF;
END $$;


-- ============================================================
-- FASE 2: Popular clinic_id em registros existentes
-- ============================================================
-- Registros sem clinic_id recebem o ID da primeira clinica.
-- Isso e CORRETO porque:
--   - O sistema atual e single-tenant (1 clinica seedada)
--   - O seed cria a clinica "Clinica Vida" com id=1
--   - Todos os dados existentes pertencem a essa clinica
--   - Em multi-tenant real, novos dados terao clinic_id correto

DO $$
DECLARE
  default_id BIGINT;
BEGIN
  SELECT id INTO default_id FROM clinics LIMIT 1;
  IF default_id IS NULL THEN
    default_id := 1;
  END IF;

  UPDATE admins SET clinic_id = default_id WHERE clinic_id IS NULL;
  UPDATE doctors SET clinic_id = default_id WHERE clinic_id IS NULL;
  UPDATE specialties SET clinic_id = default_id WHERE clinic_id IS NULL;
  UPDATE conversations SET clinic_id = default_id WHERE clinic_id IS NULL;
  UPDATE appointments SET clinic_id = default_id WHERE clinic_id IS NULL;
  UPDATE notifications SET clinic_id = default_id WHERE clinic_id IS NULL;
  UPDATE users SET clinic_id = default_id WHERE clinic_id IS NULL;
  UPDATE reminders SET clinic_id = default_id WHERE clinic_id IS NULL;

  RAISE NOTICE 'clinic_id populado com default_id=%', default_id;
END $$;


-- ============================================================
-- FASE 3: Popular clinic_members para o admin seed
-- ============================================================
-- A tabela clinic_members e usada pelo webhook LOJOU para
-- resolver qual clinica pertence a um admin.
-- Sem esse registro, o lookup sempre falha.

DO $$
DECLARE
  admin_id_var BIGINT;
  clinic_id_var BIGINT;
BEGIN
  SELECT id INTO admin_id_var FROM admins WHERE username = 'admin' LIMIT 1;
  SELECT id INTO clinic_id_var FROM clinics LIMIT 1;

  IF admin_id_var IS NOT NULL AND clinic_id_var IS NOT NULL THEN
    -- Inserir apenas se nao existir
    IF NOT EXISTS (
      SELECT 1 FROM clinic_members
      WHERE admin_id = admin_id_var AND clinic_id = clinic_id_var
    ) THEN
      INSERT INTO clinic_members (clinic_id, admin_id, role, active, created_at)
      VALUES (clinic_id_var, admin_id_var, 'owner', 1, now()::text);
      RAISE NOTICE 'clinic_members: registro criado para admin_id=% clinic_id=%', admin_id_var, clinic_id_var;
    ELSE
      RAISE NOTICE 'clinic_members: registro ja existe para admin_id=%', admin_id_var;
    END IF;
  ELSE
    RAISE WARNING 'clinic_members: admin ou clinica nao encontrados - registro nao criado';
  END IF;
END $$;


-- ============================================================
-- FASE 4: Indices para performance
-- ============================================================

-- Indice composto para usage (queries mais frequentes: WHERE clinic_id = ? AND period = ?)
CREATE INDEX IF NOT EXISTS idx_usage_clinic_period
  ON usage(clinic_id, period);

-- Indices para clinic_members (lookup por admin_id e user_id)
CREATE INDEX IF NOT EXISTS idx_clinic_members_admin_id
  ON clinic_members(admin_id);
CREATE INDEX IF NOT EXISTS idx_clinic_members_user_id
  ON clinic_members(user_id);

-- Indices para tabelas que receberam clinic_id
CREATE INDEX IF NOT EXISTS idx_admins_clinic_id ON admins(clinic_id);
CREATE INDEX IF NOT EXISTS idx_doctors_clinic_id ON doctors(clinic_id);
CREATE INDEX IF NOT EXISTS idx_specialties_clinic_id ON specialties(clinic_id);
CREATE INDEX IF NOT EXISTS idx_conversations_clinic_id ON conversations(clinic_id);
CREATE INDEX IF NOT EXISTS idx_appointments_clinic_id ON appointments(clinic_id);
CREATE INDEX IF NOT EXISTS idx_notifications_clinic_id ON notifications(clinic_id);
CREATE INDEX IF NOT EXISTS idx_users_clinic_id ON users(clinic_id);
CREATE INDEX IF NOT EXISTS idx_reminders_clinic_id ON reminders(clinic_id);


-- ============================================================
-- FASE 5: Habilitar RLS em TODAS as tabelas
-- ============================================================

ALTER TABLE clinics            ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_alerts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_events     ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins             ENABLE ROW LEVEL SECURITY;
ALTER TABLE specialties        ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors            ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_schedule    ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages           ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders          ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications      ENABLE ROW LEVEL SECURITY;
ALTER TABLE users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_members     ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_units       ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage              ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- FASE 6: Policies de protecao
-- ============================================================
--
-- POR QUE USING (false):
--   1. auth.uid() retorna NULL (app nao usa Supabase Auth)
--   2. Nao existe JWT com clinic_id no contexto atual
--   3. service_role bypassa RLS — backend funciona normalmente
--   4. Anon key e bloqueada — dados privados protegidos
--
-- COMO FUNCIONA NA PRATICA:
--   - Backend: supabaseAdmin → bypass RLS → acesso completo
--   - Anon key: policies retornam false → acesso bloqueado
--   - API REST: REVOKE impede acesso direto
--
-- MIGRACAO FUTURA (quando usar Supabase Auth):
--   Substituir USING (false) por:
--   USING (clinic_id = (
--     SELECT clinic_id FROM clinic_members
--     WHERE user_id = auth.uid() AND active = true
--   ))
-- ============================================================

-- 6.1 clinics
DROP POLICY IF EXISTS "clinics_isolation" ON clinics;
CREATE POLICY "clinics_isolation" ON clinics
  FOR ALL USING (false) WITH CHECK (false);

-- 6.2 clinic_alerts
DROP POLICY IF EXISTS "clinic_alerts_isolation" ON clinic_alerts;
CREATE POLICY "clinic_alerts_isolation" ON clinic_alerts
  FOR ALL USING (false) WITH CHECK (false);

-- 6.3 billing_events
DROP POLICY IF EXISTS "billing_events_isolation" ON billing_events;
CREATE POLICY "billing_events_isolation" ON billing_events
  FOR ALL USING (false) WITH CHECK (false);

-- 6.4 admins (contem password_hash)
DROP POLICY IF EXISTS "admins_isolation" ON admins;
CREATE POLICY "admins_isolation" ON admins
  FOR ALL USING (false) WITH CHECK (false);

-- 6.5 specialties
DROP POLICY IF EXISTS "specialties_isolation" ON specialties;
CREATE POLICY "specialties_isolation" ON specialties
  FOR ALL USING (false) WITH CHECK (false);

-- 6.6 doctors (contem phone, price)
DROP POLICY IF EXISTS "doctors_isolation" ON doctors;
CREATE POLICY "doctors_isolation" ON doctors
  FOR ALL USING (false) WITH CHECK (false);

-- 6.7 doctor_schedule
DROP POLICY IF EXISTS "doctor_schedule_isolation" ON doctor_schedule;
CREATE POLICY "doctor_schedule_isolation" ON doctor_schedule
  FOR ALL USING (false) WITH CHECK (false);

-- 6.8 conversations (contem phone, patient_name)
DROP POLICY IF EXISTS "conversations_isolation" ON conversations;
CREATE POLICY "conversations_isolation" ON conversations
  FOR ALL USING (false) WITH CHECK (false);

-- 6.9 messages (contem conteudo de conversas)
DROP POLICY IF EXISTS "messages_isolation" ON messages;
CREATE POLICY "messages_isolation" ON messages
  FOR ALL USING (false) WITH CHECK (false);

-- 6.10 appointments (contem patient_name, patient_phone)
DROP POLICY IF EXISTS "appointments_isolation" ON appointments;
CREATE POLICY "appointments_isolation" ON appointments
  FOR ALL USING (false) WITH CHECK (false);

-- 6.11 reminders
DROP POLICY IF EXISTS "reminders_isolation" ON reminders;
CREATE POLICY "reminders_isolation" ON reminders
  FOR ALL USING (false) WITH CHECK (false);

-- 6.12 notifications
DROP POLICY IF EXISTS "notifications_isolation" ON notifications;
CREATE POLICY "notifications_isolation" ON notifications
  FOR ALL USING (false) WITH CHECK (false);

-- 6.13 users (contem email, password_hash, phone)
DROP POLICY IF EXISTS "users_isolation" ON users;
CREATE POLICY "users_isolation" ON users
  FOR ALL USING (false) WITH CHECK (false);

-- 6.14 subscriptions
DROP POLICY IF EXISTS "subscriptions_isolation" ON subscriptions;
CREATE POLICY "subscriptions_isolation" ON subscriptions
  FOR ALL USING (false) WITH CHECK (false);

-- 6.15 clinic_members
DROP POLICY IF EXISTS "clinic_members_isolation" ON clinic_members;
CREATE POLICY "clinic_members_isolation" ON clinic_members
  FOR ALL USING (false) WITH CHECK (false);

-- 6.16 clinic_units
DROP POLICY IF EXISTS "clinic_units_isolation" ON clinic_units;
CREATE POLICY "clinic_units_isolation" ON clinic_units
  FOR ALL USING (false) WITH CHECK (false);

-- 6.17 usage
DROP POLICY IF EXISTS "usage_isolation" ON usage;
CREATE POLICY "usage_isolation" ON usage
  FOR ALL USING (false) WITH CHECK (false);


-- ============================================================
-- FASE 7: Revogar permissoes da role anon
-- ============================================================
-- A role anon (anon key) nao deve ter acesso a nenhuma tabela.
-- Mesmo com RLS, REVOKE e uma segunda camada de protecao.

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;

-- Garantir que service_role tem acesso completo
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;


-- ============================================================
-- FASE 8: Tabela de log de acesso (opcional)
-- ============================================================

CREATE TABLE IF NOT EXISTS api_access_log (
  id BIGSERIAL PRIMARY KEY,
  ip_address TEXT DEFAULT '',
  endpoint TEXT DEFAULT '',
  method TEXT DEFAULT '',
  status_code INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT now()::text
);

ALTER TABLE api_access_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "api_access_log_block" ON api_access_log;
CREATE POLICY "api_access_log_block" ON api_access_log
  FOR ALL USING (false) WITH CHECK (false);

REVOKE ALL ON api_access_log FROM anon;
GRANT ALL ON api_access_log TO service_role;

CREATE INDEX IF NOT EXISTS idx_api_access_log_created
  ON api_access_log(created_at);


-- ============================================================
-- MIGRATION COMPLETA
-- ============================================================
-- Tabelas com RLS: 18 (17 originais + api_access_log)
-- Policies: 18 (USING false / WITH CHECK false)
-- clinic_id adicionado: 8 tabelas
-- clinic_members populado: 1 registro (admin owner)
-- Indices: 11 novos
-- REVOKE anon: todas as tabelas
-- GRANT service_role: todas as tabelas
-- ============================================================
