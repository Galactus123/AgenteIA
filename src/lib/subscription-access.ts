// ── Regras de acesso por subscrição ────────────────────────────────────
// Módulo puro (sem Supabase nem imports de servidor): é importado pelo
// layout do servidor, pelo guard do cliente e pelos services, pelo que
// NÃO pode importar @/lib/supabase (service role nunca entra no bundle).

// Única página da app acessível sem subscrição ativa: faturação/assinatura.
export const BILLING_PATH = "/configuracoes/assinatura";

// subscriptions.status que dão acesso às funcionalidades operacionais.
// Espelha o CHECK da BD: ('none','trialing','active','past_due','cancelled','expired').
const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);

// Sem linha em subscriptions o estado é tratado como "none" → bloqueado.
export function isActiveSubscriptionStatus(status: string | null | undefined): boolean {
  return Boolean(status && ACTIVE_SUBSCRIPTION_STATUSES.has(status));
}

// true quando a página pedida é a de faturação (ou subrota dela).
export function canBrowseWithoutSubscription(pathname: string): boolean {
  return pathname === BILLING_PATH || pathname.startsWith(`${BILLING_PATH}/`);
}
