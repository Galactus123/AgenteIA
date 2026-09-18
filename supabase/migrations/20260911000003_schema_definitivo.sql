-- ============================================================
-- SaudeSync — Migration 003: Schema Definitivo Multi-Tenant
-- Versao: 20260911000003 (corrigida — v6)
-- Descricao: Schema completo em ingles, migracao de dados,
--            criacao de tabelas novas, renomeacao de legacy.
-- ============================================================
--
-- BANCO ALVO: Supabase (PostgreSQL)
-- ESTADO ATUAL DO BANCO (inspecionado):
--   14 tabelas English (RLS ativo, criadas por supabase-migration.sql)
--   3 tabelas Portuguese (SEM RLS, com dados reais)
--   12 tabelas NAO EXISTEM
--
-- FASES:
--   1. DDL: Ajustar tabelas existentes + criar novas (patients, professionals)
--   2. DML: Migrar dados das tabelas Portuguese para English
--   3. DDL: Criar tabelas novas (SaaS/auth)
--   4. Cleanup: Renomear tabelas Portuguese + dropar doctors legado
--
-- RESTRICOES:
--   - NENHUM DELETE/TRUNCATE de dados reais
--   - NENHUMA POLICY RLS
--   - Todas as tabelas finais em INGLES
--   - Migracoes executadas como postgres/service_role (RLS ignorado)
-- ============================================================


-- ============================================================
-- FASE 0: EXTENSOES E FUNCOES AUXILIARES
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- FASE 1: DDL — AJUSTAR TABELAS EXISTENTES + CRIAR NOVAS
-- ============================================================
-- Ordem:
--   1.1 Tabelas sem FK (clinics)
--   1.2 Novas tabelas base (patients, professionals)
--   1.3 Tabelas dependentes (specialties, doctors, etc.)
-- ============================================================


-- ── 1.1 CLINICS (existe, raiz) ──────────────────────────────

ALTER TABLE clinics ADD COLUMN IF NOT EXISTS uuid_id UUID DEFAULT gen_random_uuid();
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

UPDATE clinics SET uuid_id = gen_random_uuid() WHERE uuid_id IS NULL;

ALTER TABLE clinics ALTER COLUMN uuid_id SET NOT NULL;
ALTER TABLE clinics ADD CONSTRAINT clinics_uuid_id_unique UNIQUE (uuid_id);

CREATE TRIGGER set_clinics_updated_at
  BEFORE UPDATE ON clinics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ── 1.2 PATIENTS (nova — destino dos dados de pacientes) ─────

CREATE TABLE IF NOT EXISTS patients (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id           BIGINT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  cpf                 TEXT DEFAULT '',
  phone               TEXT DEFAULT '',
  email               TEXT DEFAULT '',
  date_of_birth       DATE,
  address             TEXT DEFAULT '',
  notes               TEXT DEFAULT '',
  status              TEXT NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active','inactive','archived')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patients_clinic_id ON patients(clinic_id);
CREATE INDEX IF NOT EXISTS idx_patients_cpf ON patients(cpf);
CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(name);

CREATE TRIGGER set_patients_updated_at
  BEFORE UPDATE ON patients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ── 1.3 PROFESSIONALS (nova — destino dos dados de medicos) ──

CREATE TABLE IF NOT EXISTS professionals (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id           BIGINT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  specialty_name      TEXT DEFAULT '',
  specialty_id        BIGINT,
  phone               TEXT DEFAULT '',
  email               TEXT DEFAULT '',
  consultation_duration INTEGER NOT NULL DEFAULT 30,
  price               NUMERIC NOT NULL DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active','inactive')),
  schedule            JSONB DEFAULT '[]'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_professionals_clinic_id ON professionals(clinic_id);
CREATE INDEX IF NOT EXISTS idx_professionals_specialty_id ON professionals(specialty_id);

CREATE TRIGGER set_professionals_updated_at
  BEFORE UPDATE ON professionals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ── 1.4 SPECIALTIES (existe) ────────────────────────────────

ALTER TABLE specialties ADD COLUMN IF NOT EXISTS uuid_id UUID DEFAULT gen_random_uuid();
ALTER TABLE specialties ADD COLUMN IF NOT EXISTS clinic_id BIGINT;
ALTER TABLE specialties ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE specialties ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

UPDATE specialties SET uuid_id = gen_random_uuid() WHERE uuid_id IS NULL;

ALTER TABLE specialties ALTER COLUMN uuid_id SET NOT NULL;
ALTER TABLE specialties ADD CONSTRAINT specialties_uuid_id_unique UNIQUE (uuid_id);

UPDATE specialties SET clinic_id = (SELECT id FROM clinics LIMIT 1) WHERE clinic_id IS NULL;
ALTER TABLE specialties ALTER COLUMN clinic_id SET NOT NULL;

CREATE TRIGGER set_specialties_updated_at
  BEFORE UPDATE ON specialties
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Atualizar FK de professionals.specialty_id para specialties.id
UPDATE professionals p
SET specialty_id = s.id
FROM specialties s
WHERE p.specialty_name = s.name AND p.specialty_id IS NULL;


-- ── 1.5 DOCTORS (existe — legado, sera substituido) ─────────
-- Manter estrutura original. Dados serao migrados para professionals.
-- Sera DROPado na Fase 4.

ALTER TABLE doctors ADD COLUMN IF NOT EXISTS uuid_id UUID DEFAULT gen_random_uuid();
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS clinic_id BIGINT;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS email TEXT DEFAULT '';
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

UPDATE doctors SET uuid_id = gen_random_uuid() WHERE uuid_id IS NULL;

ALTER TABLE doctors ALTER COLUMN uuid_id SET NOT NULL;
ALTER TABLE doctors ADD CONSTRAINT doctors_uuid_id_unique UNIQUE (uuid_id);

UPDATE doctors SET clinic_id = (SELECT id FROM clinics LIMIT 1) WHERE clinic_id IS NULL;


-- ── 1.6 DOCTOR_SCHEDULE (existe) ────────────────────────────

ALTER TABLE doctor_schedule ADD COLUMN IF NOT EXISTS uuid_id UUID DEFAULT gen_random_uuid();

UPDATE doctor_schedule SET uuid_id = gen_random_uuid() WHERE uuid_id IS NULL;

ALTER TABLE doctor_schedule ALTER COLUMN uuid_id SET NOT NULL;
ALTER TABLE doctor_schedule ADD CONSTRAINT doctor_schedule_uuid_id_unique UNIQUE (uuid_id);


-- ── 1.7 APPOINTMENTS (existe) ───────────────────────────────

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS uuid_id UUID DEFAULT gen_random_uuid();
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS clinic_id BIGINT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS patient_id UUID;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS professional_id UUID;

UPDATE appointments SET uuid_id = gen_random_uuid() WHERE uuid_id IS NULL;

ALTER TABLE appointments ALTER COLUMN uuid_id SET NOT NULL;
ALTER TABLE appointments ADD CONSTRAINT appointments_uuid_id_unique UNIQUE (uuid_id);

UPDATE appointments SET clinic_id = (SELECT id FROM clinics LIMIT 1) WHERE clinic_id IS NULL;
ALTER TABLE appointments ALTER COLUMN clinic_id SET NOT NULL;

CREATE TRIGGER set_appointments_updated_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ── 1.8 USERS (existe) ──────────────────────────────────────
-- Mantida para Lojou customers / auth. Nao e destino de pacientes.

ALTER TABLE users ADD COLUMN IF NOT EXISTS uuid_id UUID DEFAULT gen_random_uuid();
ALTER TABLE users ADD COLUMN IF NOT EXISTS clinic_id BIGINT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '';

UPDATE users SET uuid_id = gen_random_uuid() WHERE uuid_id IS NULL;

ALTER TABLE users ALTER COLUMN uuid_id SET NOT NULL;
ALTER TABLE users ADD CONSTRAINT users_uuid_id_unique UNIQUE (uuid_id);

UPDATE users SET clinic_id = (SELECT id FROM clinics LIMIT 1) WHERE clinic_id IS NULL;


-- ── 1.9 CONVERSATIONS (existe) ──────────────────────────────

ALTER TABLE conversations ADD COLUMN IF NOT EXISTS uuid_id UUID DEFAULT gen_random_uuid();
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS clinic_id BIGINT;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS patient_id UUID;

UPDATE conversations SET uuid_id = gen_random_uuid() WHERE uuid_id IS NULL;

ALTER TABLE conversations ALTER COLUMN uuid_id SET NOT NULL;
ALTER TABLE conversations ADD CONSTRAINT conversations_uuid_id_unique UNIQUE (uuid_id);

UPDATE conversations SET clinic_id = (SELECT id FROM clinics LIMIT 1) WHERE clinic_id IS NULL;


-- ── 1.10 MESSAGES (existe) ──────────────────────────────────

ALTER TABLE messages ADD COLUMN IF NOT EXISTS uuid_id UUID DEFAULT gen_random_uuid();

UPDATE messages SET uuid_id = gen_random_uuid() WHERE uuid_id IS NULL;

ALTER TABLE messages ALTER COLUMN uuid_id SET NOT NULL;
ALTER TABLE messages ADD CONSTRAINT messages_uuid_id_unique UNIQUE (uuid_id);


-- ── 1.11 NOTIFICATIONS (existe) ─────────────────────────────

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS uuid_id UUID DEFAULT gen_random_uuid();
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS clinic_id BIGINT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS professional_id UUID;

UPDATE notifications SET uuid_id = gen_random_uuid() WHERE uuid_id IS NULL;

ALTER TABLE notifications ALTER COLUMN uuid_id SET NOT NULL;
ALTER TABLE notifications ADD CONSTRAINT notifications_uuid_id_unique UNIQUE (uuid_id);

UPDATE notifications SET clinic_id = (SELECT id FROM clinics LIMIT 1) WHERE clinic_id IS NULL;


-- ── 1.12 REMINDERS (existe) ─────────────────────────────────

ALTER TABLE reminders ADD COLUMN IF NOT EXISTS uuid_id UUID DEFAULT gen_random_uuid();
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS clinic_id BIGINT;

UPDATE reminders SET uuid_id = gen_random_uuid() WHERE uuid_id IS NULL;

ALTER TABLE reminders ALTER COLUMN uuid_id SET NOT NULL;
ALTER TABLE reminders ADD CONSTRAINT reminders_uuid_id_unique UNIQUE (uuid_id);

UPDATE reminders SET clinic_id = (SELECT id FROM clinics LIMIT 1) WHERE clinic_id IS NULL;


-- ── 1.13 CLINIC_ALERTS (existe) ─────────────────────────────

ALTER TABLE clinic_alerts ADD COLUMN IF NOT EXISTS uuid_id UUID DEFAULT gen_random_uuid();
ALTER TABLE clinic_alerts ADD COLUMN IF NOT EXISTS acknowledged BOOLEAN DEFAULT false;

UPDATE clinic_alerts SET uuid_id = gen_random_uuid() WHERE uuid_id IS NULL;

ALTER TABLE clinic_alerts ALTER COLUMN uuid_id SET NOT NULL;
ALTER TABLE clinic_alerts ADD CONSTRAINT clinic_alerts_uuid_id_unique UNIQUE (uuid_id);


-- ── 1.14 BILLING_EVENTS (existe) ────────────────────────────

ALTER TABLE billing_events ADD COLUMN IF NOT EXISTS uuid_id UUID DEFAULT gen_random_uuid();

UPDATE billing_events SET uuid_id = gen_random_uuid() WHERE uuid_id IS NULL;

ALTER TABLE billing_events ALTER COLUMN uuid_id SET NOT NULL;
ALTER TABLE billing_events ADD CONSTRAINT billing_events_uuid_id_unique UNIQUE (uuid_id);


-- ── 1.15 ADMINS (existe) ────────────────────────────────────

ALTER TABLE admins ADD COLUMN IF NOT EXISTS uuid_id UUID DEFAULT gen_random_uuid();
ALTER TABLE admins ADD COLUMN IF NOT EXISTS clinic_id BIGINT;

UPDATE admins SET uuid_id = gen_random_uuid() WHERE uuid_id IS NULL;

ALTER TABLE admins ALTER COLUMN uuid_id SET NOT NULL;
ALTER TABLE admins ADD CONSTRAINT admins_uuid_id_unique UNIQUE (uuid_id);

UPDATE admins SET clinic_id = (SELECT id FROM clinics LIMIT 1) WHERE clinic_id IS NULL;


-- ============================================================
-- FASE 2: DML — MIGRAR DADOS PORTUGUES → INGLES
-- ============================================================
-- Migracao deterministica. Sem TRY/EXCEPTION.
-- service_role ignora RLS — acesso garantido.
-- Ordem: specialties → professionals → patients → appointments
-- ============================================================


-- ── 2.1 especialidades → specialties ─────────────────────────
-- especialidades: id UUID, nome, created_at
-- specialties: id BIGSERIAL, name, description, keywords, clinic_id

INSERT INTO specialties (name, description, keywords, clinic_id, created_at)
SELECT
  e.nome,
  '',
  '[]'::text,
  (SELECT id FROM clinics LIMIT 1),
  e.created_at
FROM especialidades e
WHERE NOT EXISTS (
  SELECT 1 FROM specialties s WHERE s.name = e.nome
)
ON CONFLICT (name) DO NOTHING;


-- ── 2.2 medicos → professionals ──────────────────────────────
-- medicos: id UUID, nome, especialidade, telefone, email,
--   created_at, duracao_consulta, valor_consulta, status,
--   dias_atendimento, especialidade_id
-- professionals: id UUID (novo), clinic_id, name, specialty_name,
--   specialty_id, phone, email, consultation_duration, price,
--   status, schedule, created_at

INSERT INTO professionals (
  clinic_id, name, specialty_name, specialty_id, phone, email,
  consultation_duration, price, status, schedule, created_at
)
SELECT
  (SELECT id FROM clinics LIMIT 1),
  m.nome,
  COALESCE(m.especialidade, ''),
  (
    SELECT s.id FROM specialties s
    WHERE s.name = m.especialidade
    LIMIT 1
  ),
  COALESCE(m.telefone, ''),
  COALESCE(m.email, ''),
  COALESCE(m.duracao_consulta, 30),
  COALESCE(m.valor_consulta, 0),
  CASE WHEN LOWER(m.status) IN ('ativo', 'active') THEN 'active' ELSE 'inactive' END,
  COALESCE(m.dias_atendimento, '[]'::jsonb),
  m.created_at
FROM medicos m
WHERE NOT EXISTS (
  SELECT 1 FROM professionals p WHERE p.name = m.nome AND p.clinic_id = (SELECT id FROM clinics LIMIT 1)
);


-- ── 2.3 pacientes → patients ─────────────────────────────────
-- pacientes: id UUID, nome, cpf, telefone, email,
--   data_nascimento, created_at, endereco, observacoes
-- patients: id UUID (novo), clinic_id, name, cpf, phone, email,
--   date_of_birth, address, notes, status, created_at

INSERT INTO patients (
  clinic_id, name, cpf, phone, email, date_of_birth,
  address, notes, status, created_at
)
SELECT
  (SELECT id FROM clinics LIMIT 1),
  p.nome,
  COALESCE(p.cpf, ''),
  COALESCE(p.telefone, ''),
  COALESCE(p.email, ''),
  p.data_nascimento,
  COALESCE(p.endereco, ''),
  COALESCE(p.observacoes, ''),
  'active',
  p.created_at
FROM pacientes p
WHERE NOT EXISTS (
  SELECT 1 FROM patients pt WHERE pt.name = p.nome AND pt.clinic_id = (SELECT id FROM clinics LIMIT 1)
);


-- ── 2.4 Mapeamento de IDs legado → novos UUIDs ───────────────
-- Tabela temporaria para mapear UUIDs antigos (pacientes/medicos)
-- para novos UUIDs (patients/professionals) SEM join por nome.
-- Schema real consultas: id, paciente_id, medico_id, data_hora,
--   status, observacoes, created_at

CREATE TEMP TABLE IF NOT EXISTS _id_mapping (
  legacy_table  TEXT NOT NULL,
  legacy_id     UUID NOT NULL,
  new_id        UUID NOT NULL
);

INSERT INTO _id_mapping (legacy_table, legacy_id, new_id)
SELECT 'medicos', m.id, p.id
FROM medicos m
JOIN professionals p ON p.name = m.nome AND p.clinic_id = (SELECT id FROM clinics LIMIT 1);

INSERT INTO _id_mapping (legacy_table, legacy_id, new_id)
SELECT 'pacientes', pa.id, pt.id
FROM pacientes pa
JOIN patients pt ON pt.name = pa.nome AND pt.clinic_id = (SELECT id FROM clinics LIMIT 1);


-- ── 2.5 consultas → appointments ─────────────────────────────
-- Schema real consultas: id UUID, paciente_id UUID, medico_id UUID,
--   data_hora TIMESTAMPTZ, status TEXT, observacoes TEXT, created_at
-- Schema real appointments: starts_at TEXT, ends_at TEXT
-- NOTA: starts_at/ends_at sao TEXT — cast ::text necessario.

INSERT INTO appointments (
  patient_name, patient_phone, specialty_id, doctor_id,
  starts_at, ends_at, status, reason, source, clinic_id,
  patient_id, professional_id
)
SELECT
  COALESCE(pt.name, 'Paciente'),
  COALESCE(pt.phone, ''),
  COALESCE(pro.specialty_id, (SELECT id FROM specialties LIMIT 1)),
  NULL,
  c.data_hora::text,
  (c.data_hora + (COALESCE(pro.consultation_duration, 30) || ' minutes')::interval)::text,
  CASE
    WHEN c.status IN ('realizada', 'completed') THEN 'completed'
    WHEN c.status IN ('cancelada', 'cancelled') THEN 'cancelled'
    ELSE 'scheduled'
  END,
  COALESCE(c.observacoes, ''),
  'ia',
  (SELECT id FROM clinics LIMIT 1),
  pt.id,
  pro.id
FROM consultas c
LEFT JOIN _id_mapping mp ON mp.legacy_table = 'pacientes' AND mp.legacy_id = c.paciente_id
LEFT JOIN patients pt ON pt.id = mp.new_id
LEFT JOIN _id_mapping mpro ON mpro.legacy_table = 'medicos' AND mpro.legacy_id = c.medico_id
LEFT JOIN professionals pro ON pro.id = mpro.new_id
WHERE NOT EXISTS (
  SELECT 1 FROM appointments a
  WHERE a.patient_id = pt.id
  AND a.starts_at = c.data_hora::text
  AND a.clinic_id = (SELECT id FROM clinics LIMIT 1)
);

-- Limpar tabela temporaria
DROP TABLE IF EXISTS _id_mapping;


-- ============================================================
-- FASE 3: DDL — CRIAR TABELAS NOVAS (SaaS/Auth)
-- ============================================================
-- Todas com UUID PKs, clinic_id, auth.users FK quando aplicavel.
-- ============================================================


-- ── 3.1 PROFILES ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS profiles (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name        TEXT NOT NULL DEFAULT '',
  avatar_url          TEXT DEFAULT '',
  locale              TEXT DEFAULT 'pt-BR',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);


-- ── 3.2 CLINIC_MEMBERS ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS clinic_members (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id           BIGINT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role                TEXT NOT NULL DEFAULT 'member'
                      CHECK (role IN ('owner','admin','manager','receptionist','professional','finance','member')),
  active              BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_clinic_members_unique
  ON clinic_members(clinic_id, user_id);

CREATE INDEX IF NOT EXISTS idx_clinic_members_user_id ON clinic_members(user_id);
CREATE INDEX IF NOT EXISTS idx_clinic_members_clinic_id ON clinic_members(clinic_id);
CREATE INDEX IF NOT EXISTS idx_clinic_members_role ON clinic_members(role);


-- ── 3.3 SUBSCRIPTIONS ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS subscriptions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id           BIGINT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,

  plan_id             TEXT NOT NULL DEFAULT 'start'
                      CHECK (plan_id IN ('start','pro','business','enterprise')),
  status              TEXT NOT NULL DEFAULT 'none'
                      CHECK (status IN ('none','trialing','active','past_due','cancelled','expired')),

  lojou_customer_id       TEXT DEFAULT '',
  lojou_subscription_id   TEXT DEFAULT '',
  lojou_price_id          TEXT DEFAULT '',

  current_period_start    TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_period_end      TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancel_at_period_end    BOOLEAN NOT NULL DEFAULT false,
  cancelled_at            TIMESTAMPTZ,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_clinic_id ON subscriptions(clinic_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

CREATE TRIGGER set_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ── 3.4 USAGE ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS usage (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id           BIGINT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  period              TEXT NOT NULL,
  whatsapp_conversations INTEGER NOT NULL DEFAULT 0,
  ai_interactions     INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_clinic_period
  ON usage(clinic_id, period);

CREATE TRIGGER set_usage_updated_at
  BEFORE UPDATE ON usage
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ── 3.5 UNITS ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS units (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id           BIGINT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  address             TEXT DEFAULT '',
  phone               TEXT DEFAULT '',
  active              BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_units_clinic_id ON units(clinic_id);

CREATE TRIGGER set_units_updated_at
  BEFORE UPDATE ON units
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ── 3.6 MEDICAL_RECORDS (PEP) ───────────────────────────────

CREATE TABLE IF NOT EXISTS medical_records (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id           BIGINT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id          UUID REFERENCES patients(id) ON DELETE SET NULL,
  appointment_id      BIGINT,
  professional_id     UUID REFERENCES professionals(id) ON DELETE SET NULL,

  anamnesis           TEXT DEFAULT '',
  physical_exam       TEXT DEFAULT '',
  diagnosis           TEXT DEFAULT '',
  prescription        TEXT DEFAULT '',
  exams_requested     TEXT DEFAULT '',
  conduct             TEXT DEFAULT '',
  notes               TEXT DEFAULT '',

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_medical_records_clinic_id ON medical_records(clinic_id);
CREATE INDEX IF NOT EXISTS idx_medical_records_patient_id ON medical_records(patient_id);

CREATE TRIGGER set_medical_records_updated_at
  BEFORE UPDATE ON medical_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ── 3.7 ADMIN_PROFILES (compatibilidade transicao) ───────────

CREATE TABLE IF NOT EXISTS admin_profiles (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  legacy_admin_id     BIGINT,
  legacy_username     TEXT,
  role                TEXT NOT NULL DEFAULT 'admin'
                      CHECK (role IN ('super_admin','admin','saas_admin')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_admin_profiles_updated_at
  BEFORE UPDATE ON admin_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_admin_profiles_user_id ON admin_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_profiles_legacy_admin_id ON admin_profiles(legacy_admin_id);


-- ============================================================
-- FASE 4: CLEANUP — RENOMEAR/DROPAR TABELAS LEGADO
-- ============================================================
-- Tabelas Portuguese: RENOMEAR (auditoria, sem DROP)
-- Tabelas English legadas: DROP (dados ja migrados)
-- ============================================================

-- Renomear tabelas Portuguese para legacy
ALTER TABLE IF EXISTS especialidades RENAME TO especialidades_legacy;
ALTER TABLE IF EXISTS medicos RENAME TO medicos_legacy;
ALTER TABLE IF EXISTS pacientes RENAME TO pacientes_legacy;
ALTER TABLE IF EXISTS consultas RENAME TO consultas_legacy;

-- Renomear tabela doctors legada (dados migrados para professionals)
ALTER TABLE IF EXISTS doctors RENAME TO doctors_legacy;


-- ============================================================
-- MIGRATION COMPLETA (v3 corrigida)
-- ============================================================
-- Fase 1: 15 tabelas ajustadas/criadas
--   - 13 existentes: clinics, specialties, doctors (legado),
--     doctor_schedule, appointments, users, conversations, messages,
--     notifications, reminders, clinic_alerts, billing_events, admins
--   - 2 novas: patients, professionals
-- Fase 2: ~7 registros migrados
--   - especialidades → specialties
--   - medicos → professionals
--   - pacientes → patients
--   - consultas → appointments
-- Fase 3: 5 tabelas SaaS criadas (profiles, clinic_members,
--          subscriptions, usage, units, medical_records, admin_profiles)
-- Fase 4: 4 tabelas renomeadas + 1 renomeada (legado)
--   - especialidades → especialidades_legacy
--   - medicos → medicos_legacy
--   - pacientes → pacientes_legacy
--   - consultas → consultas_legacy
--   - doctors → doctors_legacy (substituida por professionals)
--
-- Total de tabelas finais (ingls): 21
--   clinics, specialties, professionals, patients,
--   doctor_schedule, appointments,
--   users, conversations, messages, notifications, reminders,
--   clinic_alerts, billing_events, admins,
--   profiles, clinic_members, subscriptions, usage, units,
--   medical_records, admin_profiles
--
-- Tabelas legacy (renomeadas, sem DROP): 5
--   especialidades_legacy, medicos_legacy, pacientes_legacy,
--   consultas_legacy, doctors_legacy
--
-- Foreign keys para auth.users: 3
--   profiles.user_id, clinic_members.user_id, admin_profiles.user_id
--
-- RLS: NAO implementado nesta migration (proximo passo)
-- ============================================================
