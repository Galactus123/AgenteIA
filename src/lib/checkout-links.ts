// ── Links diretos de checkout LOJOU por plano ─────────────────────────
// Botões de assinatura da página de preços abrem o checkout da LOJOU
// diretamente (nova aba), sem passar pela API /api/subscription/checkout.
// NEXT_PUBLIC_* porque o componente de preços é client-side.
// Sem env var definida (ou fora de http/https) o plano mantém o fluxo
// antigo: botão → API de checkout → redirect após login.

import type { PlanId } from "@/lib/plans";

const LOJOU_CHECKOUT_LINKS: Partial<Record<PlanId, string | undefined>> = {
  start: process.env.NEXT_PUBLIC_LINK_CHECKOUT_LOJOU_START,
  pro: process.env.NEXT_PUBLIC_LINK_CHECKOUT_LOJOU_PRO,
};

export function getCheckoutLink(planId: PlanId): string | null {
  const link = LOJOU_CHECKOUT_LINKS[planId]?.trim();
  if (!link) return null;
  return /^https?:\/\//i.test(link) ? link : null;
}
