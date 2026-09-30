-- ============================================================
-- SaudeSync — Migration 007: FK de clinics em appointments
-- Versao: 20260930000007
-- Descricao: A 006 criou as FKs de professionals e specialties,
--            mas o app tambem embedda clinics(name, address) a
--            partir de appointments (VIEW_SELECT de appointments.ts
--            e reminders.ts). Sem essa FK o PostgREST devolve
--            PGRST200 e as paginas de consultas/dashboard/reminders
--            falham em toda leitura.
--
-- Aproveita para fechar a integridade de specialties.clinic_id,
-- que hoje e NOT NULL sem FK (permite clinic_id orfao).
--
-- RESTRICOES:
--   - NENHUM DELETE / UPDATE de dados
--   - Idempotente (guardado por DO): pode ser reexecutada
--   - Nenhuma alteracao de RLS
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'appointments'::regclass
      AND confrelid = 'clinics'::regclass
      AND contype = 'f'
  ) THEN
    ALTER TABLE appointments
      ADD CONSTRAINT appointments_clinic_id_fkey
      FOREIGN KEY (clinic_id) REFERENCES clinics(id)
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'specialties'::regclass
      AND confrelid = 'clinics'::regclass
      AND contype = 'f'
  ) THEN
    ALTER TABLE specialties
      ADD CONSTRAINT specialties_clinic_id_fkey
      FOREIGN KEY (clinic_id) REFERENCES clinics(id)
      ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_appointments_clinic
  ON appointments (clinic_id);

-- ============================================================
-- RESUMO
--   - appointments.clinic_id -> clinics(id)   (habilita embedding)
--   - specialties.clinic_id  -> clinics(id)   (integridade)
--   - indice em appointments(clinic_id)
-- ============================================================
