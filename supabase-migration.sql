-- ============================================================
-- SaudeSync — Migracao SQLite -> Supabase (PostgreSQL)
-- Execute este SQL no Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. clinics
CREATE TABLE IF NOT EXISTS clinics (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  whatsapp TEXT DEFAULT '',
  opening_hours TEXT DEFAULT '',
  location TEXT DEFAULT '',
  social_media TEXT DEFAULT '{}',
  token_limit INTEGER NOT NULL DEFAULT 100000,
  base_token_limit INTEGER NOT NULL DEFAULT 100000,
  current_token_usage INTEGER NOT NULL DEFAULT 0,
  near_limit_notified INTEGER NOT NULL DEFAULT 0,
  overage_blocks_purchased INTEGER NOT NULL DEFAULT 0,
  subscription_status TEXT NOT NULL DEFAULT 'active',
  billing_cycle_day INTEGER NOT NULL DEFAULT 1,
  last_reset_at TEXT
);

-- 2. clinic_alerts
CREATE TABLE IF NOT EXISTS clinic_alerts (
  id BIGSERIAL PRIMARY KEY,
  clinic_id BIGINT NOT NULL REFERENCES clinics(id),
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- 3. billing_events
CREATE TABLE IF NOT EXISTS billing_events (
  id BIGSERIAL PRIMARY KEY,
  clinic_id BIGINT NOT NULL REFERENCES clinics(id),
  type TEXT NOT NULL,
  amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'MZN',
  tokens INTEGER NOT NULL DEFAULT 0,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

-- 4. admins
CREATE TABLE IF NOT EXISTS admins (
  id BIGSERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  email TEXT DEFAULT '',
  clinic_id BIGINT REFERENCES clinics(id) DEFAULT 1
);

-- 5. specialties
CREATE TABLE IF NOT EXISTS specialties (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  keywords TEXT DEFAULT '[]',
  clinic_id BIGINT REFERENCES clinics(id) DEFAULT 1
);

-- 6. doctors
CREATE TABLE IF NOT EXISTS doctors (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  specialty_id BIGINT NOT NULL REFERENCES specialties(id),
  consultation_duration INTEGER NOT NULL DEFAULT 30,
  price DOUBLE PRECISION NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  phone TEXT DEFAULT '',
  clinic_id BIGINT REFERENCES clinics(id) DEFAULT 1
);

-- 7. doctor_schedule
CREATE TABLE IF NOT EXISTS doctor_schedule (
  id BIGSERIAL PRIMARY KEY,
  doctor_id BIGINT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  weekday INTEGER NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL
);

-- 8. conversations
CREATE TABLE IF NOT EXISTS conversations (
  id BIGSERIAL PRIMARY KEY,
  phone TEXT NOT NULL,
  patient_name TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  clinic_id BIGINT REFERENCES clinics(id) DEFAULT 1
);

-- 9. messages
CREATE TABLE IF NOT EXISTS messages (
  id BIGSERIAL PRIMARY KEY,
  conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- 10. appointments
CREATE TABLE IF NOT EXISTS appointments (
  id BIGSERIAL PRIMARY KEY,
  patient_name TEXT NOT NULL,
  patient_phone TEXT NOT NULL,
  specialty_id BIGINT NOT NULL REFERENCES specialties(id),
  doctor_id BIGINT NOT NULL REFERENCES doctors(id),
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled',
  reason TEXT DEFAULT '',
  source TEXT NOT NULL DEFAULT 'ia',
  rescheduled INTEGER NOT NULL DEFAULT 0,
  reschedule_count INTEGER NOT NULL DEFAULT 0,
  conversation_id BIGINT REFERENCES conversations(id),
  cancelled_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  clinic_id BIGINT REFERENCES clinics(id) DEFAULT 1
);

-- 11. reminders
CREATE TABLE IF NOT EXISTS reminders (
  id BIGSERIAL PRIMARY KEY,
  appointment_id BIGINT NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  sent_at TEXT NOT NULL,
  clinic_id BIGINT REFERENCES clinics(id) DEFAULT 1
);

-- 12. notifications
CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  appointment_id BIGINT REFERENCES appointments(id) ON DELETE SET NULL,
  doctor_id BIGINT REFERENCES doctors(id) ON DELETE SET NULL,
  read INTEGER NOT NULL DEFAULT 0,
  channel_status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  clinic_id BIGINT REFERENCES clinics(id) DEFAULT 1
);

-- 13. users
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT DEFAULT '',
  password_hash TEXT NOT NULL,
  lojou_order_id TEXT DEFAULT '',
  product_id TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  clinic_id BIGINT REFERENCES clinics(id) DEFAULT 1
);

-- 14. subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
  id BIGSERIAL PRIMARY KEY,
  clinic_id BIGINT NOT NULL REFERENCES clinics(id),
  plan_id TEXT NOT NULL DEFAULT 'start',
  status TEXT NOT NULL DEFAULT 'none',
  lojou_customer_id TEXT DEFAULT '',
  lojou_subscription_id TEXT DEFAULT '',
  current_period_start TEXT NOT NULL,
  current_period_end TEXT NOT NULL,
  cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 15. clinic_members
CREATE TABLE IF NOT EXISTS clinic_members (
  id BIGSERIAL PRIMARY KEY,
  clinic_id BIGINT NOT NULL REFERENCES clinics(id),
  user_id BIGINT,
  admin_id BIGINT REFERENCES admins(id),
  role TEXT NOT NULL DEFAULT 'admin',
  professional_id BIGINT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

-- 16. clinic_units
CREATE TABLE IF NOT EXISTS clinic_units (
  id BIGSERIAL PRIMARY KEY,
  clinic_id BIGINT NOT NULL REFERENCES clinics(id),
  name TEXT NOT NULL,
  address TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

-- 17. usage
CREATE TABLE IF NOT EXISTS usage (
  id BIGSERIAL PRIMARY KEY,
  clinic_id BIGINT NOT NULL REFERENCES clinics(id),
  period TEXT NOT NULL,
  whatsapp_conversations INTEGER NOT NULL DEFAULT 0,
  ai_interactions INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Indices para performance
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_starts_at ON appointments(starts_at);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_id ON appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_conversations_phone ON conversations(phone);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_reminders_appointment_id ON reminders(appointment_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_lojou_order_id ON users(lojou_order_id);
CREATE INDEX IF NOT EXISTS idx_doctor_schedule_doctor_id ON doctor_schedule(doctor_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_clinic_id ON subscriptions(clinic_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_clinic_members_clinic_id ON clinic_members(clinic_id);
CREATE INDEX IF NOT EXISTS idx_clinic_units_clinic_id ON clinic_units(clinic_id);
CREATE INDEX IF NOT EXISTS idx_usage_clinic_id ON usage(clinic_id);
CREATE INDEX IF NOT EXISTS idx_usage_period ON usage(period);

-- Seed: clinica padrao
INSERT INTO clinics (name, address, phone, whatsapp, opening_hours, location, social_media, token_limit, base_token_limit)
SELECT 'Clinica Vida', 'Av. Julius Nyerere 1234, Maputo', '+258 21 300 000', '+258 84 000 0000',
       'Segunda a Sexta: 08h as 18h | Sabado: 08h as 13h', 'Maputo, Mocambique',
       '{"facebook":"", "instagram":""}', 100000, 100000
WHERE NOT EXISTS (SELECT 1 FROM clinics WHERE name = 'Clinica Vida');


-- ============================================================
-- RLS: Row Level Security
-- ============================================================
-- A aplicacao usa supabaseAdmin (service_role) para acessar
-- o banco. service_role BYPARASSA RLS automaticamente.
-- A anon key e bloqueada por todas as policies.
-- ============================================================

-- Habilitar RLS em todas as tabelas
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

-- Policies: bloquear acesso via anon key
-- service_role bypassa RLS automaticamente
DO $$
DECLARE
  tbl RECORD;
  tbl_names TEXT[] := ARRAY[
    'clinics', 'clinic_alerts', 'billing_events', 'admins',
    'specialties', 'doctors', 'doctor_schedule', 'conversations',
    'messages', 'appointments', 'reminders', 'notifications',
    'users', 'subscriptions', 'clinic_members', 'clinic_units', 'usage'
  ];
  t TEXT;
BEGIN
  FOREACH t IN ARRAY tbl_names LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS "%s_isolation" ON %I',
      t, t
    );
    EXECUTE format(
      'CREATE POLICY "%s_isolation" ON %I FOR ALL USING (false) WITH CHECK (false)',
      t, t
    );
  END LOOP;
  RAISE NOTICE 'Policies de isolamento criadas para todas as tabelas';
END $$;

-- Revogar acesso da role anon
DO $$
DECLARE
  tbl RECORD;
BEGIN
  FOR tbl IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('REVOKE ALL ON %I FROM anon', tbl.tablename);
  END LOOP;
  RAISE NOTICE 'Permissoes anon revogadas';
END $$;

-- Garantir acesso da role service_role
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
