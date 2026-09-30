-- ============================================================
-- SaudeSync — Migration 006: Unificacao professionals + paridade SQLite
-- Versao: 20260930000006
-- Descricao: Fecha o "split brain" entre o modelo SQLite
--            (doctors + doctor_schedule) e o modelo Supabase
--            (professionals + schedule JSONB), apos a migracao
--            de persistencia de node:sqlite para Supabase.
--
-- O QUE MUDA:
--   1. professionals.schedule vira estruturado:
--      [{ weekday: 0..6, start_time: "HH:MM", end_time: "HH:MM" }]
--      (hoje guarda apenas rotulos de dia, sem horarios — o que
--       impedia o calculo de disponibilidade)
--   2. appointments.doctor_id deixa de ser NOT NULL; a ligacao
--      oficial passa a ser appointments.professional_id (UUID)
--   3. Indices de unicidade que faltavam (auditoria):
--      - appointments(professional_id, starts_at) p/ status='scheduled'
--      - reminders(appointment_id, type)
--      - conversations(phone)
--   4. Seed defensivo da clinica (idempotente)
--
-- RESTRICOES:
--   - NENHUM DELETE de dados reais (tabelas legadas preservadas)
--   - NENHUMA alteracao de RLS (service_role ignora RLS)
--   - Idempotente: pode ser reexecutada sem efeito colateral
--   - Nao droppa doctors_legacy / doctor_schedule (auditoria)
-- ============================================================


-- ============================================================
-- FASE 0: FUNCAO AUXILIAR DE NORMALIZACAO DE SCHEDULE
-- ============================================================

CREATE OR REPLACE FUNCTION normalize_schedule(raw jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  item         jsonb;
  result       jsonb := '[]'::jsonb;
  label        text;
  wd           integer;
  default_start text := '08:00';
  default_end   text := '17:00';
BEGIN
  IF raw IS NULL OR jsonb_typeof(raw) <> 'array' THEN
    RETURN '[]'::jsonb;
  END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(raw) LOOP
    IF jsonb_typeof(item) = 'object' THEN
      -- Ja estruturado (formato novo). Honra um eventual flag "enabled".
      IF lower(COALESCE(item->>'enabled', 'true')) = 'false' THEN
        CONTINUE;
      END IF;
      IF item->>'weekday' IS NULL OR item->>'weekday' !~ '^[0-6]$' THEN
        CONTINUE;
      END IF;
      wd := (item->>'weekday')::integer;
      result := result || jsonb_build_array(jsonb_build_object(
        'weekday',     wd,
        'start_time',  COALESCE(NULLIF(item->>'start_time', ''), default_start),
        'end_time',    COALESCE(NULLIF(item->>'end_time', ''),   default_end)
      ));

    ELSIF jsonb_typeof(item) = 'string' THEN
      -- Legado: rotulo de dia (ex.: "Seg", "Sáb", "segunda-feira").
      label := lower(btrim(item #>> '{}'));
      label := translate(label,
                         'áàãâéêíóôõúçÁÀÃÂÉÊÍÓÔÕÚÇ',
                         'aaaeeioooucAAAEEIOOOUc');
      IF    label LIKE 'dom%' THEN wd := 0;
      ELSIF label LIKE 'seg%' THEN wd := 1;
      ELSIF label LIKE 'ter%' THEN wd := 2;
      ELSIF label LIKE 'qua%' THEN wd := 3;
      ELSIF label LIKE 'qui%' THEN wd := 4;
      ELSIF label LIKE 'sex%' THEN wd := 5;
      ELSIF label LIKE 'sab%' THEN wd := 6;
      ELSE wd := NULL;
      END IF;

      IF wd IS NOT NULL THEN
        result := result || jsonb_build_array(jsonb_build_object(
          'weekday',     wd,
          'start_time',  default_start,
          'end_time',    default_end
        ));
      END IF;
    END IF;
  END LOOP;

  RETURN result;
END;
$$;


-- ============================================================
-- FASE 1: PROFESSIONALS.SCHEDULE ESTRUTURADO
-- ============================================================

UPDATE professionals
SET schedule = normalize_schedule(schedule)
WHERE schedule IS DISTINCT FROM normalize_schedule(schedule);


-- ============================================================
-- FASE 2: APPOINTMENTS — LIGACAO OFICIAL VIA PROFESSIONAL_ID
-- ============================================================
-- appointments.doctor_id referencia doctors_legacy (tabela vazia) e era
-- NOT NULL. Torna-lo anulavel permite que o INSERT deixe de escreve-lo;
-- a coluna e mantida por compatibilidade com dados legados.
-- (Se ja for anulavel, ALTER e um no-op.)

ALTER TABLE appointments ALTER COLUMN doctor_id DROP NOT NULL;

-- professional_id apontando para um professional inexistente quebraria o
-- JOIN — zera na fonte (nao ha correspondente em professionals).
UPDATE appointments a
SET professional_id = NULL
WHERE a.professional_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM professionals p WHERE p.id = a.professional_id);

UPDATE notifications n
SET professional_id = NULL
WHERE n.professional_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM professionals p WHERE p.id = n.professional_id);

UPDATE professionals p
SET specialty_id = NULL
WHERE p.specialty_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM specialties s WHERE s.id = p.specialty_id);

-- ============================================================
-- FASE 2.1: FOREIGN KEYS (habilita embedding do PostgREST)
-- ============================================================
-- Sem FK o PostgREST nao consegue servir
-- "appointments -> professionals" nem "professionals -> specialties" num
-- unico select. ON DELETE: RESTRICT em appointments (nao desmarcar um
-- profissional que tem agenda), SET NULL nos demais.
-- Guardado por DO para ser idempotente.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'appointments'::regclass
      AND confrelid = 'professionals'::regclass
      AND contype = 'f'
  ) THEN
    ALTER TABLE appointments
      ADD CONSTRAINT appointments_professional_id_fkey
      FOREIGN KEY (professional_id) REFERENCES professionals(id)
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'notifications'::regclass
      AND confrelid = 'professionals'::regclass
      AND contype = 'f'
  ) THEN
    ALTER TABLE notifications
      ADD CONSTRAINT notifications_professional_id_fkey
      FOREIGN KEY (professional_id) REFERENCES professionals(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'professionals'::regclass
      AND confrelid = 'specialties'::regclass
      AND contype = 'f'
  ) THEN
    ALTER TABLE professionals
      ADD CONSTRAINT professionals_specialty_id_fkey
      FOREIGN KEY (specialty_id) REFERENCES specialties(id)
      ON DELETE SET NULL;
  END IF;
END $$;



-- ============================================================
-- FASE 3: INDICES E UNICIDADE (achados da auditoria)
-- ============================================================

-- Mesmo profissional nao pode ter duas "scheduled" no mesmo horario.
CREATE UNIQUE INDEX IF NOT EXISTS uq_appointments_professional_start
  ON appointments (professional_id, starts_at)
  WHERE status = 'scheduled' AND professional_id IS NOT NULL;

-- Um lembrete por appointment/tipo (impede envio duplicado em corrida).
CREATE UNIQUE INDEX IF NOT EXISTS uq_reminders_appointment_type
  ON reminders (appointment_id, type);

-- getOrCreateConversation depende de unicidade por telefone.
CREATE UNIQUE INDEX IF NOT EXISTS uq_conversations_phone
  ON conversations (phone);

-- Leituras quentes do dashboard e do agendador.
CREATE INDEX IF NOT EXISTS idx_appointments_starts_at
  ON appointments (starts_at);
CREATE INDEX IF NOT EXISTS idx_appointments_status_starts_at
  ON appointments (status, starts_at);
CREATE INDEX IF NOT EXISTS idx_appointments_professional
  ON appointments (professional_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
  ON messages (conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_professionals_specialty_status
  ON professionals (specialty_id, status);
CREATE INDEX IF NOT EXISTS idx_professionals_clinic_status
  ON professionals (clinic_id, status);
CREATE INDEX IF NOT EXISTS idx_specialties_clinic
  ON specialties (clinic_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON notifications (read) WHERE read = 0;
CREATE INDEX IF NOT EXISTS idx_clinic_alerts_created
  ON clinic_alerts (created_at DESC, id DESC);


-- ============================================================
-- FASE 4: SEED DEFENSIVO DA CLINICA
-- ============================================================
-- O app assume uma clinica unica (getClinic() -> LIMIT 1) e as colunas
-- NOT NULL com DEFAULT 1 dependem de clinics.id = 1. Idempotente: so
-- insere quando nao ha nenhuma clinica.

INSERT INTO clinics (
  name, address, phone, whatsapp, opening_hours, location, social_media,
  token_limit, base_token_limit, current_token_usage, near_limit_notified,
  overage_blocks_purchased, subscription_status, billing_cycle_day, last_reset_at
)
SELECT
  'Clinica Vida',
  'Av. Julius Nyerere 1234, Maputo',
  '+258 21 300 000',
  '+258 84 000 0000',
  'Segunda a Sexta: 08h as 18h | Sabado: 08h as 13h',
  'Maputo, Mocambique',
  '{"facebook":"","instagram":""}',
  100000, 100000, 0, 0, 0, 'active', 1, NULL
WHERE NOT EXISTS (SELECT 1 FROM clinics);


-- ============================================================
-- FASE 5: LIMPEZA
-- ============================================================

DROP FUNCTION IF EXISTS normalize_schedule(jsonb);


-- ============================================================
-- RESUMO
--   - professionals.schedule normalizado para
--     [{weekday, start_time, end_time}]              (idempotente)
--   - appointments.doctor_id anulavel                (ligacao: professional_id)
--   - 2 unique + 8 indices criados                   (IF NOT EXISTS)
--   - seed de clinica                                (condicional)
--   - doctors_legacy / doctor_schedule preservados    (sem DROP)
-- ============================================================
