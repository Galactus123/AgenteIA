-- ============================================================
-- 20261002000004_cron_supabase.sql — Fase 3.1
-- Agendamento real dos jobs de producao.
--
-- Por que Supabase (pg_cron + pg_net) e nao so Vercel:
--   * Na Vercel Hobby so pode existir cron DIARIO (expressoes
--     mais frequentes falham no deploy), mas lembretes 24h/2h e
--     a fila outbox precisam de execucao a cada poucos minutos.
--   * Assim o caminho vale para qualquer plano da Vercel.
--   * O vercel.json (criado junto) mantem 3 crons diarias como
--     rede de seguranca, caso o pg_cron nao esteja habilitado.
--
-- Jobs criados (UTC):
--   saudesync_reminders  */5 * * * *      POST /api/reminders/run
--   saudesync_outbox     2-57/5 * * * *   POST /api/outbox/run
--   saudesync_cycle      43 2 * * *       POST /api/subscription/cycle/run
--
-- CONFIGURACAO APOS O DEPLOY (SQL Editor), uma unica vez:
--   SELECT vault.create_secret('https://SEU-APP.vercel.app', 'saudesync_base_url');
--   SELECT vault.create_secret('SEU_TOKEN_ALEATORIO', 'saudesync_cron_token');
-- O token de 'saudesync_cron_token' DEVE ser identico ao env
-- CRON_SECRET configurado na Vercel (ou ao INTERNAL_API_TOKEN).
-- Sem esses segredos os jobs rodam mas nao chamam nada (skip).
--
-- Guards: em banco sem as extensoes (ex.: Docker da Fase 2.5)
-- apenas emite NOTICE e nao falha — a cadeia limpa continua verde.
-- Idempotente: CREATE EXTENSION IF NOT EXISTS + unschedule/schedule.
-- ============================================================

-- 1) Extensões (vault = segredos, pg_cron = scheduler, pg_net = HTTP)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'vault') THEN
    BEGIN
      CREATE EXTENSION IF NOT EXISTS vault;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'vault: nao foi possivel habilitar (%)', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'vault indisponivel neste banco — segredos do cron nao configuraveis aqui';
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
    RAISE NOTICE 'pg_cron indisponivel neste banco — jobs do Supabase nao agendados';
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

-- 2) Jobs: chamadas HTTP ao app. O comando so dispara se
--    'saudesync_base_url' existir no Vault (senao pula em silencio).
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
    RAISE NOTICE 'vault.decrypted_secrets ausente — nenhum job agendado (habilite o vault e reexecute)';
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
