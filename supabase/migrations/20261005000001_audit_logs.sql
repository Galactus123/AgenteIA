-- ============================================================
-- 20261005000001_audit_logs.sql — Fase 6.3
-- Registro de atividades (PRD → Segurança: "Registro de atividades").
-- Trilha imutável de eventos de autenticação e de mutações de dados
-- clínicos/comerciais feitas pelo painel.
--
-- Segurança (mesmo padrão do outbox):
--   * RLS habilitado SEM policies = deny-all para anon e
--     authenticated (leitura/escrita só pelo service_role da app,
--     atrás de requireAuth nas rotas /api/audit e das mutações).
--   * REVOKE explicito do anon.
--   * PII: actor_label guarda e-mail JÁ mascarado (maskEmail) — a
--     trilha não é um segundo espelho de dados pessoais.
-- Idempotente: reexecutável com IF NOT EXISTS.
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  clinic_id BIGINT REFERENCES clinics(id) DEFAULT 1,
  actor_id TEXT,
  actor_label TEXT,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id TEXT,
  meta JSONB,
  ip TEXT,
  created_at TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
);

-- Listagem do painel: últimos eventos da clínica primeiro.
CREATE INDEX IF NOT EXISTS idx_audit_logs_clinic_created
  ON audit_logs (clinic_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action
  ON audit_logs (action);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.audit_logs FROM anon;
