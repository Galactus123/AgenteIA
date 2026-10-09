-- ============================================================
-- 20261009000002_drop_trial_leads.sql
-- Remove o funil de teste gratis da plataforma.
--
-- Motivo: o acesso passa a ser estritamente condicionado a uma
-- assinatura PAGA ativa, confirmada pelo webhook da LOJOU — sem
-- trial, sem leads publicos. Nesta mesma sessao foram removidos do
-- codigo:
--   * pagina publica /teste-gratis (formulario de captacao)
--   * POST /api/leads (gravava em trial_leads)
--   * servico src/lib/services/leads.ts (parse/save de leads)
--
-- A tabela trial_leads (criada em 20261007000001, RLS deny-all)
-- deixa de ter escritores e e removida aqui.
-- Idempotente: DROP IF EXISTS pode ser reexecutado.
-- ============================================================

DROP TABLE IF EXISTS public.trial_leads;

DO $$
BEGIN
  IF to_regclass('public.trial_leads') IS NOT NULL THEN
    RAISE EXCEPTION 'trial_leads ainda existe (drop falhou)';
  END IF;
  RAISE NOTICE 'trial_leads removida (funil de teste gratis eliminado)';
END $$;
