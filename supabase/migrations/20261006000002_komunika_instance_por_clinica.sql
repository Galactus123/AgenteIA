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
