import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase", async () => {
  const { fakeSupabase } = await import("./helpers/supabase-fake");
  return { supabaseAdmin: fakeSupabase.admin };
});

// Sessão do utilizador autenticado (requireAuth → @supabase/ssr).
const session = vi.hoisted((): { userId: string | null } => ({ userId: "user-1" }));
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getUser: async () => ({
        data: { user: session.userId ? { id: session.userId } : null },
      }),
    },
  }),
}));

import { fakeSupabase } from "./helpers/supabase-fake";
import { requireAuth, isSubscriptionExemptApi } from "@/lib/api-auth";
import {
  guardActiveSubscription,
  subscriptionGateEnabled,
} from "@/lib/services/plan-limits";
import {
  BILLING_PATH,
  canBrowseWithoutSubscription,
  isActiveSubscriptionStatus,
} from "@/lib/subscription-access";

// ── Gate de subscrição ativa ───────────────────────────────────────────────
//
// Clínica sem linha em subscriptions (ou com estado pendente/cancelado) não
// acede às funcionalidades operacionais: 402 SUBSCRIPTION_REQUIRED nas APIs e
// redirect para /configuracoes/assinatura no layout. A página de faturação e
// as rotas de auth/health ficam isentas.

interface SubRow {
  id: string;
  clinic_id: number;
  plan_id: string;
  status: string;
  lojou_customer_id: string;
  lojou_subscription_id: string;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
}

function sub(status: string): SubRow {
  return {
    id: "sub-1",
    clinic_id: 7,
    plan_id: "pro",
    status,
    lojou_customer_id: "1",
    lojou_subscription_id: "SUB-1",
    current_period_start: "2026-10-01",
    current_period_end: "2026-11-01",
    cancel_at_period_end: false,
    created_at: "2026-10-01",
    updated_at: "2026-10-01",
  };
}

function setScenario(subscription: SubRow | null): void {
  fakeSupabase.setResolver((q) => {
    if (q.table === "clinic_members") return { data: { clinic_id: 7 } };
    if (q.table === "subscriptions") return { data: subscription ? [subscription] : [] };
    if (q.table === "clinics") return { data: [{ id: 7 }] };
    return { data: q.opts.maybeSingle || q.opts.single ? null : [], count: 0, error: null };
  });
}

function apiRequest(path: string): NextRequest {
  return new NextRequest(`https://syncbot.test${path}`);
}

describe("guardActiveSubscription", () => {
  beforeEach(() => {
    fakeSupabase.reset();
    session.userId = "user-1";
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("active e trialing não bloqueiam", async () => {
    setScenario(sub("active"));
    await expect(guardActiveSubscription(7)).resolves.toBeNull();

    setScenario(sub("trialing"));
    await expect(guardActiveSubscription(7)).resolves.toBeNull();
  });

  it("sem linha em subscriptions bloqueia com 402 e estado none", async () => {
    setScenario(null);

    const gate = await guardActiveSubscription(7);

    expect(gate?.status).toBe(402);
    expect(gate?.body).toMatchObject({
      code: "SUBSCRIPTION_REQUIRED",
      subscriptionStatus: "none",
      redirectTo: BILLING_PATH,
    });
  });

  it("estados pendentes ou encerrados bloqueiam", async () => {
    for (const status of ["past_due", "cancelled", "expired", "none"]) {
      setScenario(sub(status));
      const gate = await guardActiveSubscription(7);
      expect(gate?.status, status).toBe(402);
      expect(gate?.body.subscriptionStatus, status).toBe(status);
    }
  });
});

describe("requireAuth — gate de assinatura", () => {
  beforeEach(() => {
    fakeSupabase.reset();
    session.userId = "user-1";
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("rota operacional sem assinatura ativa devolve 402 SUBSCRIPTION_REQUIRED", async () => {
    setScenario(sub("past_due"));

    const res = await requireAuth(apiRequest("/api/pacientes"));

    expect(res?.status).toBe(402);
    await expect(res?.json()).resolves.toMatchObject({
      code: "SUBSCRIPTION_REQUIRED",
      redirectTo: BILLING_PATH,
    });
  });

  it("rota operacional sem nenhuma linha de assinatura devolve 402", async () => {
    setScenario(null);

    const res = await requireAuth(apiRequest("/api/appointments"));

    expect(res?.status).toBe(402);
  });

  it("rota operacional com assinatura ativa passa (null)", async () => {
    setScenario(sub("active"));

    await expect(requireAuth(apiRequest("/api/pacientes"))).resolves.toBeNull();
  });

  it("rotas de faturação, auth e health ficam isentas do gate", async () => {
    setScenario(null);

    for (const path of [
      "/api/subscription/status",
      "/api/subscription/plan",
      "/api/auth/me",
      "/api/health",
    ]) {
      await expect(requireAuth(apiRequest(path)), path).resolves.toBeNull();
    }
  });

  it("sem sessão devolve 401 antes de qualquer consulta de assinatura", async () => {
    session.userId = null;
    setScenario(sub("active"));

    const res = await requireAuth(apiRequest("/api/pacientes"));

    expect(res?.status).toBe(401);
    expect(fakeSupabase.find("subscriptions")).toHaveLength(0);
  });
});

describe("kill switch SUBSCRIPTION_GATE_DISABLED", () => {
  beforeEach(() => {
    fakeSupabase.reset();
    session.userId = "user-1";
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    delete process.env.SUBSCRIPTION_GATE_DISABLED;
  });

  afterEach(() => {
    delete process.env.SUBSCRIPTION_GATE_DISABLED;
  });

  it("aceita 1/true/yes como desligado e o resto como ligado", () => {
    for (const value of ["1", "true", "TRUE", " yes "]) {
      process.env.SUBSCRIPTION_GATE_DISABLED = value;
      expect(subscriptionGateEnabled(), value).toBe(false);
    }
    delete process.env.SUBSCRIPTION_GATE_DISABLED;
    expect(subscriptionGateEnabled()).toBe(true);
    process.env.SUBSCRIPTION_GATE_DISABLED = "0";
    expect(subscriptionGateEnabled()).toBe(true);
  });

  it("com o gate desativado nenhuma rota operacional bloqueia", async () => {
    process.env.SUBSCRIPTION_GATE_DISABLED = "1";
    setScenario(null);

    await expect(guardActiveSubscription(7)).resolves.toBeNull();
    await expect(requireAuth(apiRequest("/api/pacientes"))).resolves.toBeNull();
    expect(fakeSupabase.find("subscriptions")).toHaveLength(0);
  });
});

describe("regras de acesso por subscrição", () => {
  it("isSubscriptionExemptApi só isenta auth, assinatura e health", () => {
    expect(isSubscriptionExemptApi("/api/auth/login")).toBe(true);
    expect(isSubscriptionExemptApi("/api/subscription/checkout")).toBe(true);
    expect(isSubscriptionExemptApi("/api/health")).toBe(true);
    expect(isSubscriptionExemptApi("/api/pacientes")).toBe(false);
    expect(isSubscriptionExemptApi("/api/authx")).toBe(false);
  });

  it("só a página de faturação pode ser aberta sem assinatura", () => {
    expect(canBrowseWithoutSubscription(BILLING_PATH)).toBe(true);
    expect(canBrowseWithoutSubscription("/dashboard")).toBe(false);
    expect(canBrowseWithoutSubscription("/configuracoes/auditoria")).toBe(false);
  });

  it("isActiveSubscriptionStatus aceita apenas active e trialing", () => {
    expect(isActiveSubscriptionStatus("active")).toBe(true);
    expect(isActiveSubscriptionStatus("trialing")).toBe(true);
    expect(isActiveSubscriptionStatus("past_due")).toBe(false);
    expect(isActiveSubscriptionStatus("cancelled")).toBe(false);
    expect(isActiveSubscriptionStatus(null)).toBe(false);
    expect(isActiveSubscriptionStatus(undefined)).toBe(false);
  });
});
