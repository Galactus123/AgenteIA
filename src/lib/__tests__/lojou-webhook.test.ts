import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { fakeSupabase } from "./helpers/supabase-fake";

vi.mock("@/lib/supabase", async () => {
  const { fakeSupabase } = await import("./helpers/supabase-fake");
  return { supabaseAdmin: fakeSupabase.admin };
});

vi.mock("@/lib/services/notifications", () => ({
  createNotification: vi.fn(async () => undefined),
}));

import { POST } from "@/app/api/webhooks/lojou/route";

// ── Webhook da Lojou: pagamento confirmado → plano + instância WhatsApp ────
//
// O módulo da Komunika NÃO é mockado: o caminho real
// (connectKomunikaInstanceForClinic → clinics.komunika_instance_id → fetch)
// é exercitado de ponta a ponta com o fetch global substituído.

const SECRET = "segredo-lojou-teste";
const CLINIC_ROW = {
  id: 7,
  base_token_limit: 100_000,
  token_limit: 100_000,
  overage_blocks_purchased: 0,
  komunika_instance_id: "inst-clinica-1",
};

type ConnectMode = "ok" | "network-error" | "http-error";
let connectMode: ConnectMode = "ok";

const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
  const target = String(url);
  if (target.includes("/instances/")) {
    if (connectMode === "network-error") throw new Error("rede em baixo");
    if (connectMode === "http-error") {
      return {
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
        text: async () => '{"message":"instancia offline"}',
      };
    }
    return { ok: true, status: 200, statusText: "OK", text: async () => '{"success":true}' };
  }
  // Resto das chamadas (envio de credenciais via /messages/send)
  return { ok: true, status: 200, statusText: "OK", text: async () => "{}" };
});

function instanceConnectCalls(): unknown[][] {
  return fetchMock.mock.calls.filter(([url]) => String(url).includes("/instances/"));
}

const originalSecret = process.env.LOJOU_WEBHOOK_SECRET;
const originalInstance = process.env.KOMUNIKA_INSTANCE_ID;
const originalToken = process.env.KOMUNIKA_API_TOKEN;

function makeRequest(payload: unknown, secret = SECRET): NextRequest {
  return new NextRequest(
    `https://syncbot.test/api/webhooks/lojou?secret=${encodeURIComponent(secret)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
}

function approvedPayload(overrides: Record<string, unknown> = {}, productId = "CZqfz") {
  return {
    event: "order_approved",
    order: {
      id: "ORD-900",
      product_id: productId,
      customer: {
        email: "clinica@example.com",
        name: "Clínica Central",
        phone: "+258841234567",
      },
    },
    ...overrides,
  };
}

interface Scenario {
  clinics?: Array<{ id: number }>;
  clinicRow?: (typeof CLINIC_ROW) | null;
  existingSubscription?: Record<string, unknown> | null;
  // Utilizador já registado: `existingUser` é encontrado por e-mail,
  // `existingUserByOrder` pelo lojou_order_id.
  existingUser?: { id: number } | null;
  existingUserByOrder?: { id: number } | null;
}

interface Captured {
  subscriptionInserts: Array<Record<string, unknown>>;
  subscriptionUpdates: Array<Record<string, unknown>>;
  clinicUpdates: Array<Record<string, unknown>>;
}

function setScenario(scenario: Scenario = {}): Captured {
  const clinics = scenario.clinics ?? [{ id: 7 }];
  const clinicRow = scenario.clinicRow === undefined ? CLINIC_ROW : scenario.clinicRow;
  const existing = scenario.existingSubscription ?? null;
  const captured: Captured = {
    subscriptionInserts: [],
    subscriptionUpdates: [],
    clinicUpdates: [],
  };

  fakeSupabase.setResolver((q) => {
    switch (q.table) {
      case "users": {
        if (q.op === "select") {
          const byOrder = q.filters.some((f) => f.startsWith("lojou_order_id="));
          const row = byOrder ? scenario.existingUserByOrder : scenario.existingUser;
          return { data: row ? [row] : [] };
        }
        return q.op === "insert" ? { data: { id: 42 } } : { data: [] };
      }
      case "admins":
      case "clinic_members":
        return { data: [] };
      case "clinics": {
        if (q.op === "select") {
          return { data: q.opts.maybeSingle ? (clinicRow ?? null) : clinics };
        }
        if (q.op === "update") {
          captured.clinicUpdates.push(q.payload as Record<string, unknown>);
          return { data: clinicRow };
        }
        return { data: null };
      }
      case "subscriptions": {
        if (q.op === "select") {
          if (!existing) return { data: [] };
          return { data: q.opts.maybeSingle ? existing : [existing] };
        }
        if (q.op === "insert") {
          const payload = q.payload as Record<string, unknown>;
          captured.subscriptionInserts.push(payload);
          return { data: { id: "sub-novo", ...payload } };
        }
        if (q.op === "update") {
          captured.subscriptionUpdates.push(q.payload as Record<string, unknown>);
          return { data: existing };
        }
        return { data: null };
      }
      default:
        return {
          data: q.opts.single || q.opts.maybeSingle ? null : [],
          count: 0,
          error: null,
        };
    }
  });

  return captured;
}

describe("Webhook Lojou — pagamento confirmado", () => {
  beforeEach(() => {
    fakeSupabase.reset();
    vi.clearAllMocks();
    fetchMock.mockClear();
    connectMode = "ok";
    vi.stubGlobal("fetch", fetchMock);
    process.env.LOJOU_WEBHOOK_SECRET = SECRET;
    // Global propositalmente diferente da instância da clínica, para provar
    // que o ID registado em clinics.komunika_instance_id tem prioridade.
    process.env.KOMUNIKA_INSTANCE_ID = "inst-global";
    process.env.KOMUNIKA_API_TOKEN = "token-teste";
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    fakeSupabase.reset();
    if (originalSecret === undefined) delete process.env.LOJOU_WEBHOOK_SECRET;
    else process.env.LOJOU_WEBHOOK_SECRET = originalSecret;
    if (originalInstance === undefined) delete process.env.KOMUNIKA_INSTANCE_ID;
    else process.env.KOMUNIKA_INSTANCE_ID = originalInstance;
    if (originalToken === undefined) delete process.env.KOMUNIKA_API_TOKEN;
    else process.env.KOMUNIKA_API_TOKEN = originalToken;
  });

  it("ativa a assinatura (service role) e dispara a ligação da instância", async () => {
    const captured = setScenario();

    const res = await POST(makeRequest(approvedPayload()));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ success: true, created: true });

    // 1. Plano/estado da assinatura gravados no Supabase via service role
    expect(captured.subscriptionInserts).toHaveLength(1);
    expect(captured.subscriptionInserts[0]).toMatchObject({
      clinic_id: 7,
      plan_id: "pro",
    });
    // Cota de tokens acompanha o plano ativado
    expect(captured.clinicUpdates[0]).toMatchObject({ base_token_limit: 500_000 });

    // 2. Instância WhatsApp da clínica ativada com o ID dela própria
    const connects = instanceConnectCalls();
    expect(connects).toHaveLength(1);
    expect(String(connects[0][0])).toContain("/instances/inst-clinica-1/connect");
    expect(String(connects[0][0])).not.toContain("inst-global");
    const logged = vi
      .mocked(console.log)
      .mock.calls.flat()
      .join(" ");
    expect(logged).toContain("inst-clinica-1");
    expect(logged).toContain("própria da clínica");
  });

  it("mapeia os IDs exatos dos produtos Lojou para o plano da assinatura", async () => {
    const captured = setScenario();
    const cases: Array<[string, string]> = [
      ["JzRcy", "start"],
      ["CZqfz", "pro"],
      ["CvPAy", "business"],
      ["Z8cWN", "enterprise"],
    ];

    for (const [productId] of cases) {
      const res = await POST(makeRequest(approvedPayload({}, productId)));
      expect(res.status).toBe(200);
    }

    expect(captured.subscriptionInserts.map((row) => row.plan_id)).toEqual(
      cases.map(([, planId]) => planId)
    );
  });

  it("produto Lojou fora do mapeamento não grava plano mas responde 200", async () => {
    const captured = setScenario();

    const res = await POST(makeRequest(approvedPayload({}, "desconhecido")));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ success: true });
    expect(captured.subscriptionInserts).toHaveLength(0);
    expect(captured.subscriptionUpdates).toHaveLength(0);
  });

  it("sem id próprio na clínica usa a instância global do ambiente", async () => {
    setScenario({ clinicRow: { ...CLINIC_ROW, komunika_instance_id: "" } });

    const res = await POST(makeRequest(approvedPayload()));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ success: true });

    const connects = instanceConnectCalls();
    expect(connects).toHaveLength(1);
    expect(String(connects[0][0])).toContain("/instances/inst-global/connect");
    const logged = vi
      .mocked(console.log)
      .mock.calls.flat()
      .join(" ");
    expect(logged).toContain("inst-global");
    expect(logged).toContain("global do ambiente");
  });

  it("cliente já registado: não recria o utilizador mas ativa plano e instância", async () => {
    const captured = setScenario({ existingUser: { id: 55 } });

    const res = await POST(makeRequest(approvedPayload()));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      success: true,
      user_id: 55,
      created: false,
    });
    expect(fakeSupabase.find("users", "insert")).toHaveLength(0);
    expect(captured.subscriptionInserts).toHaveLength(1);
    expect(captured.subscriptionInserts[0]).toMatchObject({ plan_id: "pro" });
    expect(instanceConnectCalls()).toHaveLength(1);
  });

  it("pedido já processado: idempotência do utilizador não bloqueia o pagamento", async () => {
    const captured = setScenario({ existingUserByOrder: { id: 77 } });

    const res = await POST(makeRequest(approvedPayload()));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      success: true,
      user_id: 77,
      created: false,
    });
    expect(fakeSupabase.find("users", "insert")).toHaveLength(0);
    expect(captured.subscriptionInserts).toHaveLength(1);
    expect(instanceConnectCalls()).toHaveLength(1);
  });

  it("erro de comunicação com a Komunika não quebra a resposta do webhook", async () => {
    setScenario();
    connectMode = "network-error";

    const res = await POST(makeRequest(approvedPayload()));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ success: true });

    const logged = vi
      .mocked(console.error)
      .mock.calls.flat()
      .join(" ");
    expect(logged).toContain("rede em baixo");
    expect(logged).toContain("clínica 7");
  });

  it("resposta ok:false da Komunika é registada sem afetar o webhook", async () => {
    setScenario();
    connectMode = "http-error";

    const res = await POST(makeRequest(approvedPayload()));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ success: true });
    const logged = vi
      .mocked(console.error)
      .mock.calls.flat()
      .join(" ");
    expect(logged).toContain("instancia offline");
    expect(logged).toContain("inst-clinica-1");
  });

  it("cancelamento grava status cancelled e NÃO ativa a instância", async () => {
    const captured = setScenario({
      existingSubscription: {
        id: "sub-1",
        clinic_id: 7,
        plan_id: "pro",
        status: "active",
        lojou_customer_id: "1",
        lojou_subscription_id: "SUB-1",
        current_period_start: "2026-10-01",
        current_period_end: "2026-11-01",
        cancel_at_period_end: false,
      },
    });

    const res = await POST(
      makeRequest(approvedPayload({ event: "subscription.canceled" }))
    );

    expect(res.status).toBe(200);
    expect(captured.subscriptionUpdates[0]).toMatchObject({ status: "cancelled" });
    expect(captured.subscriptionInserts).toHaveLength(0);
    expect(captured.clinicUpdates).toHaveLength(0);
    expect(instanceConnectCalls()).toHaveLength(0);
  });

  it("pagamento atrasado grava past_due e não ativa a instância", async () => {
    const captured = setScenario({
      existingSubscription: {
        id: "sub-1",
        clinic_id: 7,
        plan_id: "pro",
        status: "active",
        lojou_customer_id: "1",
        lojou_subscription_id: "SUB-1",
        current_period_start: "2026-10-01",
        current_period_end: "2026-11-01",
        cancel_at_period_end: false,
      },
    });

    const res = await POST(
      makeRequest(approvedPayload({ event: "invoice.payment_failed" }))
    );

    expect(res.status).toBe(200);
    expect(captured.subscriptionUpdates[0]).toMatchObject({ status: "past_due" });
    expect(instanceConnectCalls()).toHaveLength(0);
  });

  it("sem clínica registada não há plano nem ligação e o webhook responde 200", async () => {
    const captured = setScenario({ clinics: [], clinicRow: null });

    const res = await POST(makeRequest(approvedPayload()));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ success: true });
    expect(captured.subscriptionInserts).toHaveLength(0);
    expect(instanceConnectCalls()).toHaveLength(0);
  });

  it("idempotência: evento repetido não regrava a mesma assinatura mas reativa a instância", async () => {
    const captured = setScenario({
      existingSubscription: {
        id: "sub-1",
        clinic_id: 7,
        plan_id: "pro",
        status: "active",
        lojou_customer_id: "42",
        lojou_subscription_id: "ORD-900",
        current_period_start: "2026-10-01",
        current_period_end: "2026-11-01",
        cancel_at_period_end: false,
      },
    });

    const res = await POST(makeRequest(approvedPayload()));

    expect(res.status).toBe(200);
    expect(captured.subscriptionInserts).toHaveLength(0);
    expect(captured.subscriptionUpdates).toHaveLength(0);
    expect(instanceConnectCalls()).toHaveLength(1);
  });

  it("evento não relacionado é ignorado sem tocar na assinatura", async () => {
    const captured = setScenario();

    const res = await POST(makeRequest({ event: "customer.created" }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ received: true, ignored: true });
    expect(captured.subscriptionInserts).toHaveLength(0);
    expect(instanceConnectCalls()).toHaveLength(0);
  });

  it("rejeita secret errado antes de processar", async () => {
    setScenario();

    const res = await POST(makeRequest(approvedPayload(), "errado"));

    expect(res.status).toBe(401);
    expect(instanceConnectCalls()).toHaveLength(0);
  });
});
