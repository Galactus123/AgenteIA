"use client";

// ── Verificação de plano ativo (Modo de Visualização / read-only) ──────
// Utilizador sem plano ativo continua a navegar no dashboard em modo de
// visualização, mas as ações ativas (enviar mensagem, criar registos)
// são canceladas e o UpgradeModal é aberto.
//
// Nota de arquitetura: a tabela `profiles` NÃO tem colunas de plano
// (status/plan_type) — o plano vive em `subscriptions` (por clínica,
// gravado pelo webhook da LOJOU). Este hook consome por isso o endpoint
// /api/subscription/status, a mesma fonte de verdade do gate do servidor
// (app/layout + requireAuth), resolvida a partir da sessão do utilizador.

import { useCallback, useEffect, useState } from "react";

interface StatusPayload {
  active?: boolean;
  gateDisabled?: boolean;
  status?: string | null;
  planId?: string | null;
}

export interface PlanState {
  // true apenas com status "active" e plano que não seja "free".
  hasActivePlan: boolean;
  // true enquanto o fetch da verificação ainda está a decorrer.
  loading: boolean;
  planId: string | null;
  status: string | null;
  refetch: () => void;
}

export function usePlan(): PlanState {
  const [hasActivePlan, setHasActivePlan] = useState(false);
  const [loading, setLoading] = useState(true);
  const [planId, setPlanId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/subscription/status", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: StatusPayload | null) => {
        if (cancelled) return;
        const subStatus = data?.status ?? null;
        const subPlanId = data?.planId ?? null;
        // Regra do modo de visualização: plano ativo = estado "active" e
        // plano que não seja "free". O kill switch do gate
        // (SUBSCRIPTION_GATE_DISABLED=1) conta como acesso livre.
        const active =
          Boolean(data?.gateDisabled) ||
          (subStatus === "active" && subPlanId !== "free");
        setStatus(subStatus);
        setPlanId(subPlanId);
        setHasActivePlan(active);
      })
      .catch(() => {
        // Falha de rede: mantém bloqueado no cliente (fail-closed). O gate
        // do servidor continua a ser quem decide no fim.
        if (!cancelled) setHasActivePlan(false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [nonce]);

  // setLoading síncrono só em handler (nunca no corpo do effect — regra
  // react-hooks/set-state-in-effect): no carregamento inicial loading já
  // começa em true.
  const refetch = useCallback(() => {
    setLoading(true);
    setNonce((n) => n + 1);
  }, []);

  return { hasActivePlan, loading, planId, status, refetch };
}
