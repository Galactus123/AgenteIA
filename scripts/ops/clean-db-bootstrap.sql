-- ============================================================
-- Bootstrap de banco LIMPO para teste de migrations (Fase 2.5)
-- Uso: scripts/ops/clean-db-test.mjs aplica isto ANTES das migrations
-- ============================================================
-- Replica, no minimo, o ambiente que as migrations assumem num
-- projeto Supabase:
--
--   1. Roles anon / authenticated / service_role (NOLOGIN; a
--      service_role com BYPASSRLS — como no Supabase).
--   2. Schema auth + auth.users (vazio) + auth.uid() — as FKs de
--      profiles/clinic_members/admin_profiles e as policies usam
--      auth.uid().
--   3. Default privileges de tabelas/sequences para anon e
--      authenticated — o motivo de existir a migration 010
--      (revoke_anon): sem elas, o teste nao provaria que a 010
--      funciona.
--
-- Roda como superuser (postgres) dentro do container Docker.
-- ============================================================

-- ── 1. Roles ─────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT CREATE ON SCHEMA public TO anon, authenticated, service_role;

-- ── 2. Schema auth ───────────────────────────────────────────

CREATE SCHEMA IF NOT EXISTS auth;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS auth.users (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email              text UNIQUE,
  encrypted_password text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON auth.users TO service_role;

-- auth.uid() lida o claim `sub` do JWT de requisicao (como no GoTrue).
-- Sem requisicao autenticada retorna NULL — igual ao Supabase real.
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT (NULLIF(current_setting('request.jwt.claims', true), '')::json ->> 'sub')::uuid
$$;

GRANT EXECUTE ON FUNCTION auth.uid() TO PUBLIC;

-- ── 3. Default privileges (espelho do Supabase) ──────────────
-- Supabase concede anon/authenticated/service_role em tabelas novas.
-- A migration 010 revoga o anon — este teste prova que ela funciona.

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
