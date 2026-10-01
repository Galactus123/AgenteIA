-- ============================================================
-- SaudeSync — Migration 008: FK de patients em appointments
-- Versao: 20260930000008
-- Descricao: appointments.patient_id existe desde a 003, mas sem
--            FK para patients. O PostgREST so serve embedding
--            quando existe a FK — sem ela, o VIEW_SELECT de
--            appointments.ts / consultas.ts devolve:
--              "Could not find a relationship between
--               'appointments' and 'patients'"
--            e /api/consultas responde 500.
--
-- RESTRICOES:
--   - NENHUM DELETE / UPDATE destrutivo (so zera patient_id orfao)
--   - Idempotente (guardado por DO): pode ser reexecutada
--   - Nenhuma alteracao de RLS
-- ============================================================

DO $$
BEGIN
  -- Referencias orfas impediriam o ADD CONSTRAINT; patient_name e
  -- patient_phone sao denormalizados em appointments, entao zerar
  -- o FK preserva o historico da consulta.
  UPDATE appointments a
  SET patient_id = NULL
  WHERE a.patient_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM patients p WHERE p.id = a.patient_id);

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'appointments'::regclass
      AND confrelid = 'patients'::regclass
      AND contype = 'f'
  ) THEN
    ALTER TABLE appointments
      ADD CONSTRAINT appointments_patient_id_fkey
      FOREIGN KEY (patient_id) REFERENCES patients(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_appointments_patient
  ON appointments (patient_id);

-- ============================================================
-- RESUMO
--   - appointments.patient_id -> patients(id)  (habilita embedding)
--   - indice em appointments(patient_id)
-- ============================================================
