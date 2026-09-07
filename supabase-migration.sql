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
  email TEXT DEFAULT ''
);

-- 5. specialties
CREATE TABLE IF NOT EXISTS specialties (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  keywords TEXT DEFAULT '[]'
);

-- 6. doctors
CREATE TABLE IF NOT EXISTS doctors (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  specialty_id BIGINT NOT NULL REFERENCES specialties(id),
  consultation_duration INTEGER NOT NULL DEFAULT 30,
  price DOUBLE PRECISION NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  phone TEXT DEFAULT ''
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
  updated_at TEXT NOT NULL
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
  updated_at TEXT NOT NULL
);

-- 11. reminders
CREATE TABLE IF NOT EXISTS reminders (
  id BIGSERIAL PRIMARY KEY,
  appointment_id BIGINT NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  sent_at TEXT NOT NULL
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
  created_at TEXT NOT NULL
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
  created_at TEXT NOT NULL
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

-- Seed: clinica padrao
INSERT INTO clinics (name, address, phone, whatsapp, opening_hours, location, social_media, token_limit, base_token_limit)
SELECT 'Clinica Vida', 'Av. Julius Nyerere 1234, Maputo', '+258 21 300 000', '+258 84 000 0000',
       'Segunda a Sexta: 08h as 18h | Sabado: 08h as 13h', 'Maputo, Mocambique',
       '{"facebook":"", "instagram":""}', 100000, 100000
WHERE NOT EXISTS (SELECT 1 FROM clinics WHERE name = 'Clinica Vida');
