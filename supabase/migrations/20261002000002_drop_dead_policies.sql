-- ============================================================
-- FASE 2.6 - remover policies mortas USING (false)
-- Executar no Supabase SQL Editor (idempotente) ou via supabase db push
-- ============================================================
--
-- O QUE ESTA MIGRATION FAZ
--
--   1. Descarta TODA policy cujo qual e literalmente `false`
--      (`*_isolation` da 001/002, `anon_blocked` da 005 e
--      `api_access_log_block` da 002). Uma policy USING (false)
--      nunca concede acesso — ela so restringe. Remove-la:
--        * nao amplia acesso de `anon` (anon ja nao tem GRANT —
--          ver 20261002000001_revoke_anon_grants.sql);
--        * nao altera nada para `authenticated`: se a tabela tem
--          policies de tenant, elas continuam valendo; se nao tem,
--          RLS habilitado sem policy = acesso negado (mesmo
--          efeito que USING (false));
--        * nao altera nada para `service_role` (BYPASSRLS).
--      Efeito liquido: mesmo comportamento, menos policies mortas.
--
--   2. Corrige as policies de `doctor_schedule` (`ds_tenant_*`):
--      elas faziam JOIN com `doctors_legacy` — tabela legada que o
--      app NAO usa (o agenda e professionals.schedule JSONB; grep
--      em src/ nao encontra nenhuma leitura de doctor_schedule nem
--      de doctors_legacy). Re-apontar para `professionals` e
--      impossivel: doctor_schedule.doctor_id e BIGINT (BIGSERIAL de
--      doctors) enquanto professionals.id e UUID — nao ha join
--      valido. Correcao correta: remover `ds_tenant_*` e manter a
--      tabela com RLS ligado e NENHUMA policy (acesso: apenas
--      service_role / owner; preservada para auditoria).
--
--   3. Habilita RLS + revoga grants de anon/authenticated nas 4
--      tabelas Portuguese legacy (`*_legacy`), que ficaram SEM RLS
--      e com GRANT ALL para authenticated (004). Nenhum codigo do
--      app le essas tabelas. Em banco limpo elas nem existem (guarda
--      to_regclass).
--
-- RESTRICOES:
--   - NENHUM DELETE/UPDATE de dados
--   - NENHUM DROP de tabela ou coluna
--   - Idempotente (DROP POLICY IF EXISTS / guardas)
-- ============================================================


-- ============================================================
-- 1. POLICIES MORTAS: qual = 'false'
-- ============================================================

DO $$
DECLARE
  p record;
  dropped int := 0;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND qual = 'false'
      AND (with_check = 'false' OR with_check IS NULL)
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
                   p.policyname, p.schemaname, p.tablename);
    RAISE NOTICE 'policy morta removida: %.%', p.tablename, p.policyname;
    dropped := dropped + 1;
  END LOOP;
  RAISE NOTICE 'total de policies mortas removidas: %', dropped;
END $$;


-- ============================================================
-- 2. DOCTOR_SCHEDULE: remover policies que apontam para doctors_legacy
-- ============================================================
-- (ver cabecalho: nao ha join valido com professionals — doctor_id
--  e BIGINT e professionals.id e UUID; tabela e legada/auditoria)

DROP POLICY IF EXISTS ds_tenant_select ON doctor_schedule;
DROP POLICY IF EXISTS ds_tenant_insert ON doctor_schedule;
DROP POLICY IF EXISTS ds_tenant_update ON doctor_schedule;
DROP POLICY IF EXISTS ds_tenant_delete ON doctor_schedule;

-- RLS continua habilitado (001/002/005) e agora sem policy:
-- acesso negado para anon/authenticated, permitido para service_role.


-- ============================================================
-- 3. TABELAS PORTUGUESE LEGACY: RLS + sem grants para anon/authenticated
-- ============================================================
-- Existem apenas no banco vivo (renomeadas pela 003); em banco limpo
-- nao ha tabelas Portuguese e o bloco e um no-op.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'especialidades_legacy', 'medicos_legacy',
    'pacientes_legacy', 'consultas_legacy'
  ] LOOP
    IF to_regclass(format('public.%I', t)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('REVOKE ALL ON %I FROM anon, authenticated', t);
      EXECUTE format('GRANT ALL ON %I TO service_role', t);
      RAISE NOTICE '%: RLS habilitado, grants anon/authenticated revogados', t;
    END IF;
  END LOOP;
END $$;


-- ============================================================
-- VERIFICACAO - as consultas abaixo devem voltar VAZIAS
-- ============================================================

-- (1) policies restantes com qual = 'false' (deve ser 0 linhas)
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
  AND qual = 'false'
  AND (with_check = 'false' OR with_check IS NULL)
ORDER BY tablename, policyname;

-- (2) policies de doctor_schedule restantes (deve ser 0 linhas:
--     nenhuma policy aponta mais para doctors_legacy)
SELECT tablename, policyname, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'doctor_schedule'
ORDER BY policyname;

-- (3) tabelas do public SEM RLS (deve ser 0 linhas; em banco vivo
--     as 4 *_legacy agora estao cobertas)
SELECT c.relname AS tabela_sem_rls
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND NOT c.relrowsecurity
ORDER BY c.relname;

-- (4) inventario de policies por tabela (registro)
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
