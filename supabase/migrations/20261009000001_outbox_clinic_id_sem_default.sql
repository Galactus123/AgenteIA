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
