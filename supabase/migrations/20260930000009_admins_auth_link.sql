-- ============================================================
-- SaudeSync — Migration 009: vinculo de admins legados ao auth
-- Versao: 20260930000009
--
-- EXTRAIDA da FASE 5 da migration 20260911000005_auth_rls.sql
-- (linhas 229-324), que fazia INSERT direto em auth.users e
-- corrompeu o schema auth do projeto (colunas/triggers que nao
-- existiam). Evidencia: scripts/ops/diagnose-auth-schema.sql.
--
-- Esta versao:
--   - NUNCA escreve em auth.users — o GoTrue (signup/admin API)
--     e a unica fonte de usuarios;
--   - e idempotente: so mexe em admins ainda sem admin_profiles;
--   - nao faz DELETE nem UPDATE destrutivo;
--   - avisa (RAISE NOTICE) quando falta o usuario no auth.
--
-- Executar no SQL Editor do Supabase apos a 005.
-- ============================================================

DO $$
DECLARE
  admin_rec RECORD;
  v_user_id UUID;
  v_clinic_id BIGINT;
  v_linked INT := 0;
  v_pending INT := 0;
  v_skipped INT := 0;
BEGIN
  SELECT id INTO v_clinic_id FROM clinics ORDER BY id LIMIT 1;

  FOR admin_rec IN
    SELECT
      a.id,
      a.username,
      COALESCE(NULLIF(TRIM(a.email), ''), a.username || '@saudesync.local') AS email,
      a.role
    FROM admins a
    WHERE NOT EXISTS (
      SELECT 1 FROM admin_profiles ap WHERE ap.legacy_admin_id = a.id
    )
  LOOP
    -- Admin ja vinculado a outro usuario: nao toca.
    IF EXISTS (
      SELECT 1 FROM admin_profiles ap
      WHERE lower(COALESCE(ap.legacy_username, '')) = lower(admin_rec.username)
    ) THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    SELECT u.id INTO v_user_id
    FROM auth.users u
    WHERE lower(u.email) = lower(admin_rec.email)
    LIMIT 1;

    IF v_user_id IS NULL THEN
      RAISE NOTICE
        'Admin legado "%" sem usuario em auth.users (%). Crie o usuario (signup ou scripts/ops/recreate-auth-user.mjs) e reexecute.',
        admin_rec.username, admin_rec.email;
      v_pending := v_pending + 1;
      CONTINUE;
    END IF;

    INSERT INTO admin_profiles (user_id, legacy_admin_id, legacy_username, role)
    VALUES (
      v_user_id,
      admin_rec.id,
      admin_rec.username,
      CASE
        WHEN admin_rec.role IN ('super_admin', 'admin', 'saas_admin')
          THEN admin_rec.role
        ELSE 'admin'
      END
    )
    ON CONFLICT (user_id) DO NOTHING;

    IF v_clinic_id IS NOT NULL THEN
      INSERT INTO clinic_members (clinic_id, user_id, role, active)
      VALUES (v_clinic_id, v_user_id, 'owner', true)
      ON CONFLICT (clinic_id, user_id) DO NOTHING;
    END IF;

    v_linked := v_linked + 1;
    RAISE NOTICE 'Admin "%" vinculado ao usuario %', admin_rec.username, v_user_id;
  END LOOP;

  RAISE NOTICE 'Resultado: % vinculados, % pendentes (sem auth.users), % ja vinculados.',
    v_linked, v_pending, v_skipped;
END $$;
