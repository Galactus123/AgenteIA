import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("@/lib/supabase", async () => {
  const { fakeSupabase } = await import("./helpers/supabase-fake");
  return { supabaseAdmin: fakeSupabase.admin };
});

// Sessão do utilizador autenticado (requireClinic → @supabase/ssr).
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
import { requireClinic } from "@/lib/api-auth";

// ── requireClinic — contexto de clínica das rotas operacionais ──────────────
//
// fail-closed em três camadas: sessão ausente → 401, sessão sem clínica
// resolvida ou sem linha ativa em subscriptions → 402 (gate por clínica),
// e — só com o gate desativado — sessão válida sem vínculo ativo em
// clinic_members → 403. O clinic_id devolvido vem SEMPRE do vínculo do
// próprio utilizador — nunca de um fallback "primeira clínica da base".

function apiRequest(path = "/api/pacientes"): NextRequest {
  return new NextRequest(`https://syncbot.test${path}`);
}

function setScenario(opts: {
  member?: { clinic_id: number | string } | null;
  subscription?: boolean;
} = {}): void {
  const member = "member" in opts ? opts.member : { clinic_id: 7 };
  const subscription = opts.subscription !== false;
  fakeSupabase.setResolver((q) => {
    if (q.table === "clinic_members") return { data: member };
    if (q.table === "subscriptions") {
      return {
        data: subscription
          ? [
              {
                id: "sub-1",
                clinic_id: 7,
                plan_id: "pro",
                status: "active",
              },
            ]
          : [],
      };
    }
    if (q.table === "clinics") return { data: [{ id: 7 }] };
    return { data: q.opts.maybeSingle || q.opts.single ? null : [], count: 0, error: null };
  });
}

beforeEach(() => {
  fakeSupabase.reset();
  session.userId = "user-1";
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("requireClinic", () => {
  it("sem sessão devolve 401 sem tocar na base", async () => {
    session.userId = null;
    setScenario();

    const res = await requireClinic(apiRequest());

    expect(res).toBeInstanceOf(NextResponse);
    expect((res as NextResponse).status).toBe(401);
    expect(fakeSupabase.queries).toHaveLength(0);
  });

  it("sessão com vínculo devolve o contexto da própria clínica do user", async () => {
    setScenario();

    const res = await requireClinic(apiRequest());

    expect(res).not.toBeInstanceOf(NextResponse);
    expect(res).toMatchObject({ clinicId: 7, user: { id: "user-1" } });

    const q = fakeSupabase.last("clinic_members");
    expect(q?.filters).toContain("user_id=user-1");
    expect(q?.filters).toContain("active=true");
    expect(q?.filters).toContain("limit:1");
  });

  it("clinic_id chegado como string vira number", async () => {
    setScenario({ member: { clinic_id: "12" } });

    const res = await requireClinic(apiRequest());

    expect(res).not.toBeInstanceOf(NextResponse);
    expect(res).toMatchObject({ clinicId: 12 });
  });

  it("sessão sem vínculo ativo responde 402 do gate (nunca a clínica #1)", async () => {
    setScenario({ member: null });

    const res = await requireClinic(apiRequest());

    expect(res).toBeInstanceOf(NextResponse);
    const response = res as NextResponse;
    // Sem clinic_id o gate por clínica é fail-closed com 402 — o 403 do
    // requireClinic só é alcançável com o gate desativado (kill switch).
    expect(response.status).toBe(402);
    expect((await response.json()).code).toBe("SUBSCRIPTION_REQUIRED");
    // Nunca cai na "primeira clínica" da base.
    expect(fakeSupabase.find("clinics")).toHaveLength(0);
  });

  it("erro na resolução do vínculo também responde 402 fail-closed", async () => {
    fakeSupabase.setResolver((q) => {
      if (q.table === "clinic_members") return { error: { message: "timeout" } };
      if (q.table === "subscriptions") {
        return { data: [{ id: "sub-1", clinic_id: 7, plan_id: "pro", status: "active" }] };
      }
      return { data: [], count: 0, error: null };
    });

    const res = await requireClinic(apiRequest());

    expect(res).toBeInstanceOf(NextResponse);
    expect((res as NextResponse).status).toBe(402);
    expect(console.error).toHaveBeenCalled();
    expect(fakeSupabase.find("subscriptions", "select")).toHaveLength(0);
  });

  it("com o gate desativado, sem vínculo devolve 403 (defesa em profundidade)", async () => {
    process.env.SUBSCRIPTION_GATE_DISABLED = "1";
    setScenario({ member: null });

    try {
      const res = await requireClinic(apiRequest());

      expect(res).toBeInstanceOf(NextResponse);
      const response = res as NextResponse;
      expect(response.status).toBe(403);
      expect((await response.json()).error).toContain("clínica");
    } finally {
      delete process.env.SUBSCRIPTION_GATE_DISABLED;
    }
  });

  it("sem assinatura ativa o gate responde 402 antes de entregar o contexto", async () => {
    setScenario({ subscription: false });

    const res = await requireClinic(apiRequest());

    expect(res).toBeInstanceOf(NextResponse);
    const response = res as NextResponse;
    expect(response.status).toBe(402);
    expect((await response.json()).code).toBe("SUBSCRIPTION_REQUIRED");
  });

  it("rota isenta de faturação ignora o gate e devolve o contexto", async () => {
    setScenario({ subscription: false });

    const res = await requireClinic(apiRequest("/api/subscription/usage"));

    expect(res).not.toBeInstanceOf(NextResponse);
    expect(res).toMatchObject({ clinicId: 7 });
  });
});
