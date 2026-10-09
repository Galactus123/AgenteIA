-- ============================================================
-- Verificacao pos-migracoes (Fase 2.5) — banco limpo
-- Uso: scripts/ops/clean-db-test.mjs roda isto com ON_ERROR_STOP=1
-- ============================================================
-- Qualquer CHECK falho aborta com RAISE EXCEPTION (exit != 0).
-- Os SELECTs de inventario no final viram registro no log.
-- ============================================================

-- CHECK 1: seed de clinica presente
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM clinics;
  IF n < 1 THEN
    RAISE EXCEPTION 'CHECK 1 falhou: sem seed de clinics (n=%)', n;
  END IF;
  RAISE NOTICE 'CHECK 1 ok: % clinica(s) seed', n;
END $$;

-- CHECK 2: TODAS as tabelas do public com RLS habilitado
DO $$
DECLARE r record; missing text := '';
BEGIN
  FOR r IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
  LOOP
    missing := missing || r.relname || ' ';
  END LOOP;
  IF missing <> '' THEN
    RAISE EXCEPTION 'CHECK 2 falhou: tabelas sem RLS: %', missing;
  END IF;
  RAISE NOTICE 'CHECK 2 ok: todas as tabelas do public com RLS';
END $$;

-- CHECK 3: nenhuma policy morta USING (false) sobrou (Fase 2.6)
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n
  FROM pg_policies
  WHERE schemaname = 'public'
    AND qual = 'false'
    AND (with_check = 'false' OR with_check IS NULL);
  IF n > 0 THEN
    RAISE EXCEPTION 'CHECK 3 falhou: % policy/policies USING (false) restantes', n;
  END IF;
  RAISE NOTICE 'CHECK 3 ok: zero policies USING (false)';
END $$;

-- CHECK 4: doctor_schedule sem policies que apontam para doctors_legacy
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'doctor_schedule';
  IF n > 0 THEN
    RAISE EXCEPTION 'CHECK 4 falhou: % policy/policies restantes em doctor_schedule', n;
  END IF;
  RAISE NOTICE 'CHECK 4 ok: doctor_schedule sem policies (legado, RLS deny-all)';
END $$;

-- CHECK 5: anon sem privilegio de tabela/sequence no public
DO $$
DECLARE r record; bad text := '';
BEGIN
  FOR r IN
    SELECT c.oid, c.relname, c.relkind
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
  LOOP
    IF r.relkind = 'r' AND has_table_privilege('anon', r.oid, 'SELECT') THEN
      bad := bad || r.relname || ' ';
    ELSIF r.relkind = 'S' AND has_sequence_privilege('anon', r.oid, 'USAGE') THEN
      bad := bad || r.relname || '(seq) ';
    END IF;
  END LOOP;
  IF bad <> '' THEN
    RAISE EXCEPTION 'CHECK 5 falhou: anon ainda tem acesso a: %', bad;
  END IF;
  RAISE NOTICE 'CHECK 5 ok: anon sem privilegios em tabelas/sequences';
END $$;

-- CHECK 6: nenhuma ACL explicita cita anon
DO $$
DECLARE r record; bad text := '';
BEGIN
  FOR r IN
    SELECT c.relname, c.relacl::text AS acl
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relacl IS NOT NULL
      AND c.relacl::text LIKE '%anon%'
  LOOP
    bad := bad || r.relname || ' ';
  END LOOP;
  IF bad <> '' THEN
    RAISE EXCEPTION 'CHECK 6 falhou: relacl cita anon em: %', bad;
  END IF;
  RAISE NOTICE 'CHECK 6 ok: nenhuma ACL cita anon';
END $$;

-- CHECK 7: Foreign keys obrigatorias (embedding PostgREST + integridade)
DO $$
DECLARE
  pair record;
  missing text := '';
BEGIN
  FOR pair IN
    SELECT * FROM (VALUES
      ('appointments', 'patients'),
      ('appointments', 'professionals'),
      ('appointments', 'clinics'),
      ('appointments', 'specialties'),
      ('notifications', 'professionals'),
      ('professionals', 'specialties'),
      ('specialties', 'clinics'),
      ('clinic_members', 'auth.users'),
      ('profiles', 'auth.users'),
      ('admin_profiles', 'auth.users'),
      ('subscriptions', 'clinics'),
      ('usage', 'clinics')
    ) AS t(child, parent)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = to_regclass('public.' || pair.child)
        AND confrelid = to_regclass(pair.parent)
        AND contype = 'f'
    ) THEN
      missing := missing || pair.child || '->' || pair.parent || ' ';
    END IF;
  END LOOP;
  IF missing <> '' THEN
    RAISE EXCEPTION 'CHECK 7 falhou: FK ausente: %', missing;
  END IF;
  RAISE NOTICE 'CHECK 7 ok: 12 FKs obrigatorias presentes';
END $$;

-- CHECK 8: indices de unicidade obrigatorios
DO $$
DECLARE
  names text[] := ARRAY[
    'uq_appointments_professional_start',
    'uq_reminders_appointment_type',
    'uq_conversations_phone',
    'idx_clinic_members_unique',
    'clinics_uuid_id_unique'
  ];
  n text; missing text := '';
BEGIN
  FOREACH n IN ARRAY names LOOP
    IF to_regclass('public.' || n) IS NULL THEN
      missing := missing || n || ' ';
    END IF;
  END LOOP;
  IF missing <> '' THEN
    RAISE EXCEPTION 'CHECK 8 falhou: indice ausente: %', missing;
  END IF;
  RAISE NOTICE 'CHECK 8 ok: indices de unicidade presentes';
END $$;

-- CHECK 9: shape definitivo das tabelas SaaS (paridade com o banco vivo)
DO $$
DECLARE bad text := '';
BEGIN
  IF (SELECT data_type FROM information_schema.columns
      WHERE table_schema='public' AND table_name='clinic_members' AND column_name='user_id')
     <> 'uuid' THEN
    bad := bad || 'clinic_members.user_id nao e uuid; ';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='clinic_members' AND column_name='admin_id') THEN
    bad := bad || 'clinic_members ainda tem admin_id; ';
  END IF;
  IF (SELECT data_type FROM information_schema.columns
      WHERE table_schema='public' AND table_name='usage' AND column_name='id')
     <> 'uuid' THEN
    bad := bad || 'usage.id nao e uuid; ';
  END IF;
  IF (SELECT data_type FROM information_schema.columns
      WHERE table_schema='public' AND table_name='subscriptions' AND column_name='id')
     <> 'uuid' THEN
    bad := bad || 'subscriptions.id nao e uuid; ';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='subscriptions' AND column_name='cancelled_at') THEN
    bad := bad || 'subscriptions.cancelled_at ausente; ';
  END IF;
  IF bad <> '' THEN
    RAISE EXCEPTION 'CHECK 9 falhou: %', bad;
  END IF;
  RAISE NOTICE 'CHECK 9 ok: shape definitivo de clinic_members/usage/subscriptions';
END $$;

-- CHECK 10: rename legado da 003 (doctors -> doctors_legacy)
DO $$
BEGIN
  IF to_regclass('public.doctors_legacy') IS NULL THEN
    RAISE EXCEPTION 'CHECK 10 falhou: doctors_legacy nao existe (003 nao renomeou)';
  END IF;
  IF to_regclass('public.doctors') IS NOT NULL THEN
    RAISE EXCEPTION 'CHECK 10 falhou: tabela doctors ainda existe (003 nao renomeou)';
  END IF;
  RAISE NOTICE 'CHECK 10 ok: doctors -> doctors_legacy';
END $$;

-- CHECK 11: funcoes auxiliares existem
DO $$
BEGIN
  IF to_regprocedure('public.get_user_clinic_ids()') IS NULL THEN
    RAISE EXCEPTION 'CHECK 11 falhou: get_user_clinic_ids() ausente (005)';
  END IF;
  IF to_regprocedure('public.update_updated_at_column()') IS NULL THEN
    RAISE EXCEPTION 'CHECK 11 falhou: update_updated_at_column() ausente (003)';
  END IF;
  RAISE NOTICE 'CHECK 11 ok: funcoes auxiliares presentes';
END $$;

-- CHECK 12: funil trial removido (20261009000002_drop_trial_leads)
DO $$
BEGIN
  IF to_regclass('public.trial_leads') IS NOT NULL THEN
    RAISE EXCEPTION 'CHECK 12 falhou: trial_leads ainda existe (drop 20261009000002 nao aplicado)';
  END IF;
  RAISE NOTICE 'CHECK 12 ok: trial_leads removida (acesso estrito pos-pagamento)';
END $$;


-- ============================================================
-- REGISTRO (inventario para o log)
-- ============================================================

SELECT 'tabelas' AS item, count(*)::text AS valor
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
UNION ALL
SELECT 'tabelas_sem_rls', count(*)::text
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
UNION ALL
SELECT 'policies_total', count(*)::text FROM pg_policies WHERE schemaname = 'public'
UNION ALL
SELECT 'policies_using_false', count(*)::text
FROM pg_policies WHERE schemaname = 'public' AND qual = 'false'
UNION ALL
SELECT 'clinics_seed', count(*)::text FROM clinics;

SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

SELECT c.relname AS tabela
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY c.relname;
