// ── Links diretos de checkout LOJOU ───────────────────────────────────
// Botões de assinatura (UpgradeModal, página /precos e CTAs da landing)
// abrem o checkout da LOJOU diretamente (nova aba), sem passar pela API
// de checkout.
//
// LINK OFICIAL DO PROJETO (commitado no código): https://pay.lojou.app/KMPZe
// Usado pelos 4 planos (start/pro/business/enterprise) quando não há env
// var válida — todos os CTAs de assinatura apontam para o mesmo checkout.
//
// Override opcional por plano via env var (NEXT_PUBLIC_* porque os
// componentes são client-side: sem o prefixo a variável NÃO é inlined no
// bundle). Nome atual: NEXT_PUBLIC_LINK_DIRETO_LOJOU_START / _PRO /
// _BUSINESS / _ENTERPRISE; nome antigo (NEXT_PUBLIC_LINK_CHECKOUT_LOJOU_*)
// mantido como fallback.
//
// O valor é saneado antes de virar href: aspas/quebras de linha coladas
// num .env tornam o href relativo (o browser acaba por abrir outro
// recurso, ex. um chunk .js), e valores sem protocolo são completados
// com https:// quando parecem um domínio. Env var inválida cai no link
// oficial commitado — nunca fica href quebrado.

import type { PlanId } from "@/lib/plans";

// Link oficial de checkout LOJOU do projeto (fonte única de verdade).
export const LOJOU_CHECKOUT_URL = "https://pay.lojou.app/KMPZe";

const RAW_LINKS: Partial<Record<PlanId, string | undefined>> = {
  start:
    process.env.NEXT_PUBLIC_LINK_DIRETO_LOJOU_START ??
    process.env.NEXT_PUBLIC_LINK_CHECKOUT_LOJOU_START,
  pro:
    process.env.NEXT_PUBLIC_LINK_DIRETO_LOJOU_PRO ??
    process.env.NEXT_PUBLIC_LINK_CHECKOUT_LOJOU_PRO,
  business:
    process.env.NEXT_PUBLIC_LINK_DIRETO_LOJOU_BUSINESS ??
    process.env.NEXT_PUBLIC_LINK_CHECKOUT_LOJOU_BUSINESS,
  enterprise:
    process.env.NEXT_PUBLIC_LINK_DIRETO_LOJOU_ENTERPRISE ??
    process.env.NEXT_PUBLIC_LINK_CHECKOUT_LOJOU_ENTERPRISE,
};

// Avisa uma única vez por valor inválido (facilita diagnosticar a env var
// mal escrita no Vercel / .env.local).
const warned = new Set<string>();

function warnInvalid(raw: string): void {
  if (warned.has(raw)) return;
  warned.add(raw);
  console.warn(
    `[checkout-links] Valor de env var de checkout inválido (não é URL http(s)): "${raw}"`
  );
}

// Exportado para teste unitário (sanitização dos valores vindos das env vars).
export function sanitizeCheckoutUrl(raw: string | undefined): string | null {
  if (!raw) return null;

  let url = raw
    .trim()
    // Aspas e quebras de linha coladas (colagem no painel do Vercel/.env).
    .replace(/^['"]+|['"]+$/g, "")
    .replace(/[\r\n\t]+/g, "")
    .trim();
  if (!url) return null;

  // Protocolo relativo (//checkout.lojou.com/…) → https://checkout…
  if (url.startsWith("//")) url = `https:${url}`;

  if (!/^https?:\/\//i.test(url)) {
    // Sem protocolo: só completa com https:// quando parece um domínio
    // (ex.: checkout.lojou.com/pay/…). Caminhos relativos são recusados
    // — é a classe de erro que faz o botão abrir um recurso interno.
    if (/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(url)) {
      url = `https://${url}`;
    } else {
      warnInvalid(raw);
      return null;
    }
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      warnInvalid(raw);
      return null;
    }
    return parsed.toString();
  } catch {
    warnInvalid(raw);
    return null;
  }
}

// Link de checkout de um plano: env var saneada (override) ou o link
// oficial commitado acima. Vale para os 4 planos da tabela de preços.
export function getCheckoutLink(planId: PlanId): string | null {
  return (
    sanitizeCheckoutUrl(RAW_LINKS[planId]) ??
    sanitizeCheckoutUrl(LOJOU_CHECKOUT_URL)
  );
}
