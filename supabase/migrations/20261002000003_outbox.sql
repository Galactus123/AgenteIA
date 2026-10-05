-- ============================================================
-- 20261002000003_outbox.sql — Fase 3.4
-- Fila duravel de mensagens de saida (WhatsApp via Komunika).
-- Toda mensagem de saida (resposta da IA, lembrete, aviso de
-- transferencia) entra aqui e so sai apos confirmacao de envio;
-- falhas reentram com backoff (attempts/next_attempt_at) ate
-- OUTBOX_MAX_ATTEMPTS e depois viram 'failed'.
--
-- Seguranca:
--   * RLS habilitado SEM policies = deny-all para anon e
--     authenticated (apenas o service_role da app usa a fila).
--   * REVOKE explicito do anon (as default privileges do
--     Supabase concedem a toda tabela nova).
-- Idempotente: reexecutavel com IF NOT EXISTS.
-- ============================================================

CREATE TABLE IF NOT EXISTS outbox (
  id BIGSERIAL PRIMARY KEY,
  conversation_id BIGINT,
  phone TEXT NOT NULL,
  text TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'chat_reply',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sending', 'sent', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI'),
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI'),
  updated_at TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI'),
  clinic_id BIGINT REFERENCES clinics(id) DEFAULT 1
);

-- Fila pronta: pendentes vencidos primeiro (o filtro de status e
-- aplicado na query; o indice acelera a varredura por vencimento).
CREATE INDEX IF NOT EXISTS idx_outbox_next_attempt
  ON outbox (next_attempt_at)
  WHERE status IN ('pending', 'sending');

CREATE INDEX IF NOT EXISTS idx_outbox_status
  ON outbox (status);

ALTER TABLE outbox ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.outbox FROM anon;
