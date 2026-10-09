-- ============================================================
-- scripts/ops/pending-migrations.sql
-- Migrations PENDENTES na base de dados de producao (Supabase),
-- concatenadas em ordem cronologica (batim de supabase/migrations/).
--
-- Gerado em 09/10/2026. Sondagem read-only (PostgREST + service
-- role) do mesmo dia confirmou em producao:
--   [x] FALTA 20261006000001_quota_counters_atomicos
--        (RPC increment_clinic_token_usage nao existe — a app cai
--         no caminho legado read-modify-write com race)
--   [x] FALTA 20261006000002_komunika_instance_por_clinica
--        (coluna clinics.komunika_instance_id nao existe —
--         multi-instancia inerte, sempre a instancia global)
--   [?] N/D   20261009000001_outbox_clinic_id_sem_default
--        (so DROP DEFAULT — nao verificavel via REST; incluida
--         por precaucao: reexecucao e no-op)
--   [?] N/D   20261002000004_cron_supabase
--        (estado do pg_cron nao verificavel via REST; idempotente,
--         seguro reexecutar; em banco sem extensoes so emite NOTICE)
--
-- As 4 sao idempotentes: seguras quer o objeto ja exista quer nao
-- (reexecucao = no-op).
--
-- COMO USAR (SQL Editor do Supabase, ambiente de PRODUCAO):
--   1. Colar TODO o ficheiro e executar UMA vez.
--   2. Ler os NOTICEs: tem de terminar com
--      "VERIFICACAO: 4/4 migrations pendentes aplicadas".
--   3. Um EXCEPTION "FALTA: ..." significa falha acima — nao
--      confiar no estado, reexecutar.
--
-- NAO inclui (acao manual, fora do SQL):
--   * regenerar/ativar o token da API Komunika no painel Komunika
--     (bloqueia a Fase 7.2 — so depois, refazer KOMUNIKA_API_TOKEN
--     na Vercel);
--   * segredos do Vault saudesync_base_url / saudesync_cron_token
--     (ver cabecalho da 20261002000004) — sem eles os jobs pg_cron
--     ficam agendados mas nao chamam o app (os 3 crons diarios da
--     Vercel continuam como rede de seguranca).
--
-- Validado em banco limpo (Docker postgres:16): 15 migrations
-- pre-existentes (estado tipo producao) + este script => 1a
-- execucao "VERIFICACAO: 4/4", 2a execucao idempotente, 11/11
-- CHECKs do clean-db-verify.sql ok e grants da RPC anon=false /
-- service_role=true.
-- ============================================================

-- >>>>>>>>>>>> BEGIN supabase/migrations/20261002000004_cron_supabase.sql (batim) <<<<<<<<<<<<

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
-- >>>>>>>>>>>> END supabase/migrations/20261002000004_cron_supabase.sql <<<<<<<<<<<<

-- >>>>>>>>>>>> BEGIN supabase/migrations/20261006000001_quota_counters_atomicos.sql (batim) <<<<<<<<<<<<

-- ============================================================
-- 20261006000001_quota_counters_atomicos.sql - quotas por plano
-- ------------------------------------------------------------
-- Contadores de quota deixam de ser "read-modify-write" na app:
-- duas mensagens simultaneas liam o mesmo total e uma perdia a
-- contagem. Aqui o Postgres soma em um unico UPDATE, atomico.
--
-- Funcoes (chamadas via supabaseAdmin.rpc):
--   * increment_clinic_token_usage(clinic, amount) -> novo total
--     (clinics.current_token_usage, cota de tokens da IA).
--   * increment_usage_counters(clinic, period, wa, ai) -> linha
--     (usage: conversas WhatsApp + interacoes IA do periodo,
--     upsert no indice unico clinic_id+period).
--
-- Seguranca:
--   * SECURITY DEFINER + SET search_path = public (sem dependencia
--     de search_path do chamador).
--   * EXECUTE so para service_role: anon/authenticated nao podem
--     incrementar contadores de terceiros pela API PostgREST.
--   * A app trata o caso da funcao ainda nao existir (banco nao
--     migrado) e cai no caminho legado - logo esta migration e
--     obrigatoria antes de confiar na contagem.
--
-- Idempotente: CREATE OR REPLACE + grants reexecutaveis.
-- ============================================================

CREATE OR REPLACE FUNCTION public.increment_clinic_token_usage(
  p_clinic_id BIGINT,
  p_amount INTEGER
) RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usage BIGINT;
BEGIN
  UPDATE clinics
     SET current_token_usage =
           current_token_usage + GREATEST(COALESCE(p_amount, 0), 0)
   WHERE id = p_clinic_id
  RETURNING current_token_usage INTO v_usage;

  -- -1 = clinica inexistente: o chamador mantem o comportamento legado.
  RETURN COALESCE(v_usage, -1);
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_usage_counters(
  p_clinic_id BIGINT,
  p_period TEXT,
  p_whatsapp INTEGER,
  p_ai INTEGER
) RETURNS public.usage
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.usage;
BEGIN
  INSERT INTO public.usage AS u (
    clinic_id,
    period,
    whatsapp_conversations,
    ai_interactions,
    created_at,
    updated_at
  )
  VALUES (
    p_clinic_id,
    p_period,
    GREATEST(COALESCE(p_whatsapp, 0), 0),
    GREATEST(COALESCE(p_ai, 0), 0),
    now(),
    now()
  )
  ON CONFLICT (clinic_id, period) DO UPDATE
     SET whatsapp_conversations =
           u.whatsapp_conversations + EXCLUDED.whatsapp_conversations,
         ai_interactions =
           u.ai_interactions + EXCLUDED.ai_interactions,
         updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_clinic_token_usage(BIGINT, INTEGER)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.increment_usage_counters(BIGINT, TEXT, INTEGER, INTEGER)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.increment_clinic_token_usage(BIGINT, INTEGER)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_usage_counters(BIGINT, TEXT, INTEGER, INTEGER)
  TO service_role;
-- >>>>>>>>>>>> END supabase/migrations/20261006000001_quota_counters_atomicos.sql <<<<<<<<<<<<

-- >>>>>>>>>>>> BEGIN supabase/migrations/20261006000002_komunika_instance_por_clinica.sql (batim) <<<<<<<<<<<<

-- ============================================================
-- 20261006000002_komunika_instance_por_clinica
-- ------------------------------------------------------------
-- Suporte a multiplas instancias da Komunika: cada clinica pode
-- ter a sua propria instancia WhatsApp.
--
--   clinics.komunika_instance_id (TEXT, default '')
--     vazio            -> usa a instancia global KOMUNIKA_INSTANCE_ID
--     preenchido       -> usa a instancia desta clinica
--
-- A coluna e a que o webhook da Lojou consulta ao ativar a
-- assinatura (connectKomunikaInstanceForClinic).
-- Idempotente: ADD COLUMN IF NOT EXISTS pode ser reexecutado.
-- ============================================================

ALTER TABLE clinics
  ADD COLUMN IF NOT EXISTS komunika_instance_id TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN clinics.komunika_instance_id
  IS 'ID da instancia WhatsApp Komunika desta clinica (vazio = instancia global KOMUNIKA_INSTANCE_ID)';

-- O service_role ja tem grants de base em clinics; garante leitura/escrita
-- da coluna nova mesmo em ambientes com privileges minimas.
GRANT SELECT, UPDATE ON public.clinics TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'clinics'
       AND column_name  = 'komunika_instance_id'
  ) THEN
    RAISE EXCEPTION 'clinics.komunika_instance_id nao foi criada';
  END IF;
END $$;
-- >>>>>>>>>>>> END supabase/migrations/20261006000002_komunika_instance_por_clinica.sql <<<<<<<<<<<<

-- >>>>>>>>>>>> BEGIN supabase/migrations/20261009000001_outbox_clinic_id_sem_default.sql (batim) <<<<<<<<<<<<

-- ============================================================
-- 20261009000001_outbox_clinic_id_sem_default.sql
-- A coluna outbox.clinic_id (criada em 20261002000003) nascia com
-- DEFAULT 1: qualquer fila sem clinic_id explicito herdava a
-- clinica #1 — fail-open multi-tenant (envios pela instancia
-- errada quando uma clinica sem registro tentava enviar).
--
-- Modelo pos-pagamento (decisao: gate e instancia POR clinica):
--   * clinic_id explicito  -> outbox.deliver usa
--     clinics.komunika_instance_id da propria linha;
--   * clinic_id NULL       -> fallback para a instancia global
--     KOMUNIKA_INSTANCE_ID (comportamento legado single-tenant).
--
-- A aplicacao passa a gravar sempre o clinic_id resolvido; as
-- linhas legadas ja escritas com 1 sao mantidas (nao ha como
-- distinguir "clinica 1 real" de "herdado do default").
-- Idempotente: reexecutavel.
-- ============================================================

ALTER TABLE outbox ALTER COLUMN clinic_id DROP DEFAULT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'outbox'
      AND column_name = 'clinic_id'
      AND column_default IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'outbox.clinic_id ainda tem DEFAULT (fail-open multi-tenant)';
  END IF;
  RAISE NOTICE 'outbox.clinic_id sem DEFAULT: NULL = instancia global, numero = instancia da clinica';
END $$;
-- >>>>>>>>>>>> END supabase/migrations/20261009000001_outbox_clinic_id_sem_default.sql <<<<<<<<<<<<

-- ============================================================
-- VERIFICACAO FINAL — falha (EXCEPTION) se algo faltar
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'clinics'
       AND column_name  = 'komunika_instance_id'
  ) THEN
    RAISE EXCEPTION 'FALTA: clinics.komunika_instance_id (20261006000002)';
  END IF;

  IF to_regprocedure('public.increment_clinic_token_usage(bigint, integer)') IS NULL THEN
    RAISE EXCEPTION 'FALTA: public.increment_clinic_token_usage(BIGINT, INTEGER) (20261006000001)';
  END IF;

  IF to_regprocedure('public.increment_usage_counters(bigint, text, integer, integer)') IS NULL THEN
    RAISE EXCEPTION 'FALTA: public.increment_usage_counters(BIGINT, TEXT, INTEGER, INTEGER) (20261006000001)';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'outbox'
       AND column_name  = 'clinic_id'
       AND column_default IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'FALHA: outbox.clinic_id ainda tem DEFAULT (20261009000001)';
  END IF;

  RAISE NOTICE 'VERIFICACAO: 4/4 migrations pendentes aplicadas';
END $$;

-- Inventario do cron (informativo; NOTICEs na caixa de mensagens)
DO $$
DECLARE
  v_jobs int := -1;
BEGIN
  IF to_regclass('cron.job') IS NOT NULL THEN
    SELECT count(*) INTO v_jobs FROM cron.job WHERE jobname LIKE 'saudesync_%';
  END IF;

  IF v_jobs = -1 THEN
    RAISE NOTICE 'pg_cron indisponivel — jobs nao verificaveis (o guard da 20261002000004 ja emitiu NOTICE)';
  ELSIF v_jobs = 0 THEN
    RAISE NOTICE 'pg_cron ativo mas 0 jobs saudesync_* — reexecute o bloco da 20261002000004';
  ELSE
    RAISE NOTICE 'pg_cron: % job(s) saudesync_* agendados', v_jobs;
  END IF;
END $$;
