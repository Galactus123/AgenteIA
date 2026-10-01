-- ============================================================
-- SaudeSync — Migration 005: Supabase Auth + RLS
-- Versao: 20260911000005
-- Descricao: Habilita RLS em todas as tabelas, cria policies
--            multi-tenant, migra admins para auth.users.
-- ============================================================
--
-- PREREQUISITOS:
--   1. Supabase Auth HABILITADO no painel do projeto
--   2. Email/Password provider ATIVADO
--   3. Migration 003 executada com sucesso
--
-- ESTRATEGIA:
--   - service_role: bypass RLS (rotas API internas)
--   - authenticated: RLS por tenant via clinic_members
--   - anon: bloqueado (USING false)
-- ============================================================


-- ============================================================
-- FASE 1: HABILITAR RLS EM TODAS AS TABELAS
-- ============================================================

ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE professionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE specialties ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_profiles ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- FASE 2: FUNCAO HELPER — IDs das clínicas do usuário
-- ============================================================

CREATE OR REPLACE FUNCTION get_user_clinic_ids()
RETURNS SETOF BIGINT
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT cm.clinic_id
  FROM clinic_members cm
  WHERE cm.user_id = auth.uid()
    AND cm.active = true;
$$;


-- ============================================================
-- FASE 3: POLICIES — BLOQUEAR ANON (já existe, reforçar)
-- ============================================================
-- Mantém bloqueio total para conexões anônimas.
-- Nota: muitas tabelas já têm policies USING(false) da migration 001.
-- Estas novas garantem cobertura total.

DO $$
DECLARE
  t text;
  tables_no_policy text[] := ARRAY[
    'patients', 'professionals', 'profiles', 'admin_profiles',
    'units', 'medical_records'
  ];
BEGIN
  FOREACH t IN ARRAY tables_no_policy LOOP
    EXECUTE format(
      'CREATE POLICY anon_blocked ON %I FOR ALL USING (false) WITH CHECK (false)',
      t
    );
  END LOOP;
END $$;


-- ============================================================
-- FASE 4: POLICIES — TENANT ISOLATION (authenticated)
-- ============================================================
-- Padrão: clinic_id IN (SELECT get_user_clinic_ids())
-- Para tabelas sem clinic_id: policies específicas.

-- ── Grupo 1: Tabelas COM clinic_id ─────────────────────────

DO $$
DECLARE
  t text;
  tables_with_clinic text[] := ARRAY[
    'patients', 'professionals', 'specialties', 'appointments',
    'users', 'conversations', 'notifications', 'reminders',
    'clinic_alerts', 'billing_events', 'admins',
    'subscriptions', 'usage', 'units', 'medical_records'
  ];
BEGIN
  FOREACH t IN ARRAY tables_with_clinic LOOP
    -- SELECT
    EXECUTE format(
      'CREATE POLICY tenant_select ON %I FOR SELECT
       USING (clinic_id IN (SELECT get_user_clinic_ids()))',
      t
    );
    -- INSERT
    EXECUTE format(
      'CREATE POLICY tenant_insert ON %I FOR INSERT
       WITH CHECK (clinic_id IN (SELECT get_user_clinic_ids()))',
      t
    );
    -- UPDATE
    EXECUTE format(
      'CREATE POLICY tenant_update ON %I FOR UPDATE
       USING (clinic_id IN (SELECT get_user_clinic_ids()))
       WITH CHECK (clinic_id IN (SELECT get_user_clinic_ids()))',
      t
    );
    -- DELETE
    EXECUTE format(
      'CREATE POLICY tenant_delete ON %I FOR DELETE
       USING (clinic_id IN (SELECT get_user_clinic_ids()))',
      t
    );
  END LOOP;
END $$;


-- ── Grupo 2: Tabelas SEM clinic_id ─────────────────────────

-- clinic_members: usuário vê apenas seus próprios registros
CREATE POLICY cm_own_select ON clinic_members
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY cm_own_insert ON clinic_members
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- profiles: usuário vê apenas seu próprio perfil
CREATE POLICY profiles_own_select ON profiles
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY profiles_own_insert ON profiles
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY profiles_own_update ON profiles
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- admin_profiles: usuário vê apenas seu próprio perfil
CREATE POLICY admin_profiles_own_select ON admin_profiles
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY admin_profiles_own_insert ON admin_profiles
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY admin_profiles_own_update ON admin_profiles
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- messages: via conversation → clinic
CREATE POLICY messages_tenant_select ON messages
  FOR SELECT USING (
    conversation_id IN (
      SELECT c.id FROM conversations c
      WHERE c.clinic_id IN (SELECT get_user_clinic_ids())
    )
  );
CREATE POLICY messages_tenant_insert ON messages
  FOR INSERT WITH CHECK (
    conversation_id IN (
      SELECT c.id FROM conversations c
      WHERE c.clinic_id IN (SELECT get_user_clinic_ids())
    )
  );

-- doctor_schedule: via doctor → clinic
CREATE POLICY ds_tenant_select ON doctor_schedule
  FOR SELECT USING (
    doctor_id IN (
      SELECT d.id FROM doctors_legacy d
      WHERE d.clinic_id IN (SELECT get_user_clinic_ids())
    )
  );
CREATE POLICY ds_tenant_insert ON doctor_schedule
  FOR INSERT WITH CHECK (
    doctor_id IN (
      SELECT d.id FROM doctors_legacy d
      WHERE d.clinic_id IN (SELECT get_user_clinic_ids())
    )
  );
CREATE POLICY ds_tenant_update ON doctor_schedule
  FOR UPDATE USING (
    doctor_id IN (
      SELECT d.id FROM doctors_legacy d
      WHERE d.clinic_id IN (SELECT get_user_clinic_ids())
    )
  )
  WITH CHECK (
    doctor_id IN (
      SELECT d.id FROM doctors_legacy d
      WHERE d.clinic_id IN (SELECT get_user_clinic_ids())
    )
  );
CREATE POLICY ds_tenant_delete ON doctor_schedule
  FOR DELETE USING (
    doctor_id IN (
      SELECT d.id FROM doctors_legacy d
      WHERE d.clinic_id IN (SELECT get_user_clinic_ids())
    )
  );

-- clinics: usuário vê apenas clínicas das quais é membro
CREATE POLICY clinics_member_select ON clinics
  FOR SELECT USING (
    id IN (SELECT get_user_clinic_ids())
  );


-- ============================================================
-- FASE 5: MIGRAR ADMINS EXISTENTES → AUTH.USERS  (REMOVIDA)
-- ============================================================
-- A versao original desta fase fazia INSERT direto em auth.users
-- (colunas e triggers que nem sempre existem) e CORROMPEU o schema
-- auth do projeto — causa do incidente de login de 27/09/2026.
--
-- Ela foi extraida para:
--   supabase/migrations/20260930000009_admins_auth_link.sql
-- que NAO escreve em auth.users (GoTrue e a unica fonte de usuarios),
-- e idempotente — pode ser reexecutada num banco vivo.
--
-- Se esta migration ja rodou no seu banco, nao ha nada a desfazer:
-- a funcao auxiliar era droppada no final e nao deixa residuo.
-- ============================================================


-- ============================================================
-- FASE 6: GARANTIR PERMISSÕES DE TABELA
-- ============================================================
-- service_role já bypass RLS via grant da role.
-- Estes grants são para authenticated (RLS controla acesso).

GRANT SELECT, INSERT, UPDATE, DELETE ON patients TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON professionals TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON specialties TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON appointments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON reminders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON clinic_alerts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON billing_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON admins TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON doctor_schedule TO authenticated;
GRANT SELECT ON clinics TO authenticated;
GRANT SELECT, INSERT, UPDATE ON profiles TO authenticated;
GRANT SELECT, INSERT ON clinic_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON subscriptions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON usage TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON units TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON medical_records TO authenticated;
GRANT SELECT, INSERT, UPDATE ON admin_profiles TO authenticated;

-- Sequences (para INSERT com BIGSERIAL/UUID)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;


-- ============================================================
-- MIGRATION COMPLETA
-- ============================================================
-- Fase 1: RLS habilitado em 21 tabelas
-- Fase 2: Função get_user_clinic_ids() criada
-- Fase 3: Policies anon_blocked em 6 tabelas novas
-- Fase 4: Policies tenant_* em 21 tabelas (SELECT/INSERT/UPDATE/DELETE)
-- Fase 5: Admins migrados para auth.users + admin_profiles + clinic_members
-- Fase 6: GRANTs para authenticated (RLS controla acesso)
--
-- PRÓXIMOS PASSOS:
--   1. Configurar Supabase Auth no painel (Email/Password)
--   2. Atualizar código Next.js (@supabase/ssr)
--   3. Testar fluxo de login
-- ============================================================
