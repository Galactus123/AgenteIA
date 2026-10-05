-- ============================================================
-- setup-cron-secrets.sql — Fase 3.1 (configuracao operacional do agendador)
--
-- O que faz (idempotente, reexecutavel):
--   1) Habilita vault + pg_cron + pg_net (guards: so NOTICE se faltar);
--   2) Cria/atualiza os segredos no Vault:
--        saudesync_cron_token = CRON_SECRET da Vercel
--        saudesync_base_url   = PUBLIC_URL do app
--      (upsert por nome — reexecutar nao duplica);
--   3) Agenda os 3 jobs do pg_cron (mesmo bloco da migration
--      20261002000004_cron_supabase.sql, que PULA em silencio quando o
--      vault ainda nao esta habilitado — e e por isso que este script
--      precisa rodar DEPOIS de habilitar o vault);
--   4) Imprime a verificacao final.
--
-- ONDE RODAR: SQL Editor do Supabase (banco vivo) como postgres.
-- O QUE TROCAR: __CRON_SECRET__ pelo valor de CRON_SECRET (mesmo valor
--   gravado na Vercel e no .env.local). A URL abaixo ja e o PUBLIC_URL.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Extensoes: vault (segredos), pg_cron (scheduler), pg_net (HTTP)
-- ------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'vault') THEN
    BEGIN
      CREATE EXTENSION IF NOT EXISTS vault;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'vault: nao foi possivel habilitar (%)', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'vault indisponivel neste banco — segredos nao configuraveis aqui';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    BEGIN
      CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
      GRANT USAGE ON SCHEMA cron TO postgres;
      GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'pg_cron: nao foi possivel habilitar (%)', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'pg_cron indisponivel neste banco — jobs nao agendados';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_net') THEN
    BEGIN
      CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'pg_net: nao foi possivel habilitar (%)', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'pg_net indisponivel neste banco — HTTP do cron nao agendado';
  END IF;
END $$;

-- ------------------------------------------------------------
-- 2) Segredos do Vault (upsert por nome)
-- ------------------------------------------------------------
DO $$
DECLARE
  v_token text := '__CRON_SECRET__';
  v_url   text := 'https://syncbot-123.vercel.app';
  v_id    uuid;
  v_desc  text := 'Fase 3.1 — agendador pg_cron -> /api/*/run (igual ao CRON_SECRET da Vercel)';
BEGIN
  IF to_regclass('vault.decrypted_secrets') IS NULL THEN
    RAISE NOTICE 'vault ainda indisponivel — segredos NAO gravados';
    RETURN;
  END IF;

  IF v_token = '__CRON_SECRET__' OR v_token = '' THEN
    RAISE NOTICE 'PLACEHOLDER __CRON_SECRET__ nao substituido — segredos NAO gravados';
    RETURN;
  END IF;

  SELECT id INTO v_id FROM vault.decrypted_secrets WHERE name = 'saudesync_cron_token';
  IF v_id IS NULL THEN
    PERFORM vault.create_secret(v_token, 'saudesync_cron_token', v_desc);
    RAISE NOTICE 'segredo saudesync_cron_token criado (len=%)', length(v_token);
  ELSE
    PERFORM vault.update_secret(v_id, v_token, 'saudesync_cron_token', v_desc);
    RAISE NOTICE 'segredo saudesync_cron_token ATUALIZADO (len=%)', length(v_token);
  END IF;

  SELECT id INTO v_id FROM vault.decrypted_secrets WHERE name = 'saudesync_base_url';
  IF v_id IS NULL THEN
    PERFORM vault.create_secret(v_url, 'saudesync_base_url', v_desc);
    RAISE NOTICE 'segredo saudesync_base_url criado';
  ELSE
    PERFORM vault.update_secret(v_id, v_url, 'saudesync_base_url', v_desc);
    RAISE NOTICE 'segredo saudesync_base_url ATUALIZADO';
  END IF;
END $$;

-- ------------------------------------------------------------
-- 3) Jobs do pg_cron (identico a migration 20261002000004; idempotente:
--    unschedule + schedule = sempre 3 jobs, nunca duplica)
-- ------------------------------------------------------------
DO $$
DECLARE
  tpl text;
  cmd_reminders text;
  cmd_outbox text;
  cmd_cycle text;
BEGIN
  IF to_regprocedure('cron.schedule(text,text,text)') IS NULL THEN
    RAISE NOTICE 'cron.schedule indisponivel — nenhum job agendado';
    RETURN;
  END IF;
  IF to_regclass('vault.decrypted_secrets') IS NULL THEN
    RAISE NOTICE 'vault.decrypted_secrets ausente — nenhum job agendado';
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'net' AND p.proname = 'http_post'
  ) THEN
    RAISE NOTICE 'net.http_post ausente — nenhum job agendado';
    RETURN;
  END IF;

  tpl := $c$
    SELECT CASE
      WHEN coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'saudesync_base_url'), '') = '' THEN NULL
      ELSE net.http_post(
        url := rtrim((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'saudesync_base_url'), '/') || %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'saudesync_cron_token'), '')
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 30000
      )
    END;
  $c$;

  cmd_reminders := format(tpl, '/api/reminders/run');
  cmd_outbox    := format(tpl, '/api/outbox/run');
  cmd_cycle     := format(tpl, '/api/subscription/cycle/run');

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'saudesync_reminders') THEN
    EXECUTE format('SELECT cron.unschedule(%L)', 'saudesync_reminders');
  END IF;
  EXECUTE format('SELECT cron.schedule(%L, %L, %L)', 'saudesync_reminders', '*/5 * * * *', cmd_reminders);

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'saudesync_outbox') THEN
    EXECUTE format('SELECT cron.unschedule(%L)', 'saudesync_outbox');
  END IF;
  EXECUTE format('SELECT cron.schedule(%L, %L, %L)', 'saudesync_outbox', '2-57/5 * * * *', cmd_outbox);

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'saudesync_cycle') THEN
    EXECUTE format('SELECT cron.unschedule(%L)', 'saudesync_cycle');
  END IF;
  EXECUTE format('SELECT cron.schedule(%L, %L, %L)', 'saudesync_cycle', '43 2 * * *', cmd_cycle);

  RAISE NOTICE 'Jobs agendados: saudesync_reminders (5 min), saudesync_outbox (5 min), saudesync_cycle (diario 02:43 UTC)';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Falha ao agendar jobs do cron: %', SQLERRM;
END $$;

-- ------------------------------------------------------------
-- 4) Verificacao (nao imprime segredos, so nomes/tamanhos)
-- ------------------------------------------------------------
SELECT name, length(decrypted_secret) AS len
FROM vault.decrypted_secrets
WHERE name LIKE 'saudesync_%'
ORDER BY name;

SELECT jobname, schedule FROM cron.job ORDER BY jobname;

-- Depois de 5-10 min, conferir as execucoes:
--   SELECT jobid, status, return_message FROM cron.job_run_details
--   ORDER BY start_time DESC LIMIT 5;
