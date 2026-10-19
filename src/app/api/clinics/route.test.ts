import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase", async () => {
  const { fakeSupabase } = await import("@/lib/__tests__/helpers/supabase-fake");
  return { supabaseAdmin: fakeSupabase.admin };
});

// Sessão do utilizador autenticado (requireAuth/getUser → @supabase/ssr).
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

import { fakeSupabase } from "@/lib/__tests__/helpers/supabase-fake";
import { resetRateLimits } from "@/lib/rate-limit";
import { GET, POST } from "./route";
import { PATCH } from "./active/route";

// ── /api/clinics e /api/clinics/active (Fase 1 multi-clínica) ──────────────
//
// GET lista os vínculos do próprio utilizador (corpo do pedido nunca escopa),
// POST cria clínica + vínculo owner com compensação, PATCH troca a clínica
// ativa gravando user_active_clinic e o cookie sd_active_clinic — depois de
// validar o vínculo em clinic_members (403 sem acesso).

interface Membership {
  clinic_id: number;
  role: string;
  name: string;
  subscriptionStatus: string | null;
}

function membershipRow(m: Membership) {
  return {
    clinic_id: m.clinic_id,
    role: m.role,
    clinics: {
      id: m.clinic_id,
      name: m.name,
      subscriptions: m.subscriptionStatus ? [{ status: m.subscriptionStatus }] : [],
    },
  };
}

function setScenario(opts: {
  memberships?: Membership[];
  stored?: number | null;
  storedError?: { message: string; code?: string } | null;
  insertClinicId?: number | null;
  memberInsertError?: boolean;
} = {}): void {
  const memberships = opts.memberships ?? [
    { clinic_id: 3, role: "member", name: "Clínica Saúde Viva", subscriptionStatus: "active" },
    { clinic_id: 7, role: "owner", name: "Clínica Bem Estar", subscriptionStatus: "cancelled" },
  ];
  const stored = "stored" in opts ? opts.stored : null;
  fakeSupabase.setResolver((q) => {
    if (q.table === "user_active_clinic") {
      if (opts.storedError) return { error: opts.storedError };
      if (q.op === "upsert") return { data: null };
      return { data: stored === null ? null : { clinic_id: stored } };
    }
    if (q.table === "clinic_members") {
      if (q.op === "insert") {
        return opts.memberInsertError ? { error: { message: "fk inválida" } } : { data: null };
      }
      const clinicFilter = q.filters.find((f) => f.startsWith("clinic_id="));
      if (clinicFilter && q.opts.maybeSingle) {
        // Validação pontual de vínculo (PATCH).
        const id = Number(clinicFilter.slice("clinic_id=".length));
        return {
          data: memberships.some((m) => m.clinic_id === id) ? { clinic_id: id } : null,
        };
      }
      if (q.opts.maybeSingle) {
        // Fallback legado: menor clinic_id ativo.
        const lowest = [...memberships].sort((a, b) => a.clinic_id - b.clinic_id)[0];
        return { data: lowest ? { clinic_id: lowest.clinic_id } : null };
      }
      // Listagem (GET).
      return { data: memberships.map(membershipRow), count: 0, error: null };
    }
    if (q.table === "clinics") {
      if (q.op === "insert") {
        return opts.insertClinicId === null
          ? { error: { message: "insert falhou" } }
          : { data: { id: opts.insertClinicId ?? 42 } };
      }
      if (q.op === "delete") return { data: null };
      return { data: [{ id: 7 }], count: 0, error: null };
    }
    if (q.table === "subscriptions") {
      return { data: [{ id: "sub-1", clinic_id: 7, plan_id: "pro", status: "active" }] };
    }
    return { data: q.opts.maybeSingle || q.opts.single ? null : [], count: 0, error: null };
  });
}

function get(path = "/api/clinics", headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(`https://syncbot.test${path}`, { headers });
}

function send(
  method: "POST" | "PATCH",
  path: string,
  body: unknown,
  headers: Record<string, string> = {}
): NextRequest {
  return new NextRequest(`https://syncbot.test${path}`, {
    method,
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  fakeSupabase.reset();
  session.userId = "user-1";
  resetRateLimits();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET /api/clinics", () => {
  it("sem sessão devolve 401", async () => {
    session.userId = null;
    setScenario();

    const res = await GET(get());

    expect(res.status).toBe(401);
  });

  it("lista os vínculos do próprio utilizador com clínica atual", async () => {
    setScenario({ memberships: [
      { clinic_id: 3, role: "member", name: "Clínica Saúde Viva", subscriptionStatus: "active" },
      { clinic_id: 7, role: "owner", name: "Clínica Bem Estar", subscriptionStatus: "cancelled" },
    ] });

    const res = await GET(get());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.currentClinicId).toBe(3); // fallback = menor id
    expect(body.clinics).toHaveLength(2);
    expect(body.clinics[0]).toMatchObject({
      id: 3,
      name: "Clínica Saúde Viva",
      role: "member",
      hasActiveSubscription: true,
      isCurrent: true,
    });
    expect(body.clinics[1]).toMatchObject({
      id: 7,
      name: "Clínica Bem Estar",
      role: "owner",
      hasActiveSubscription: false, // cancelled não é ativa
      isCurrent: false,
    });

    // A listagem é sempre pelo user_id da sessão.
    const list = fakeSupabase.find("clinic_members").pop();
    expect(list?.filters).toContain("user_id=user-1");
    expect(list?.filters).toContain("active=true");
  });

  it("cookie sd_active_clinic validado define a clínica atual", async () => {
    setScenario();

    const res = await GET(get("/api/clinics", { cookie: "sd_active_clinic=7" }));
    const body = await res.json();

    expect(body.currentClinicId).toBe(7);
    expect(body.clinics.find((c: { id: number }) => c.id === 7).isCurrent).toBe(true);
    expect(body.clinics.find((c: { id: number }) => c.id === 3).isCurrent).toBe(false);
  });

  it("erro da listagem responde 500 sem vazar detalhes", async () => {
    setScenario();
    fakeSupabase.setResolver((q) => {
      if (q.table === "clinic_members" && !q.opts.maybeSingle) {
        return { error: { message: "connection reset" } };
      }
      return { data: q.opts.maybeSingle || q.opts.single ? null : [], count: 0, error: null };
    });

    const res = await GET(get());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBeTruthy();
    expect(JSON.stringify(body)).not.toContain("connection reset");
  });
});

describe("POST /api/clinics", () => {
  it("sem nome devolve 400", async () => {
    setScenario();

    const res = await POST(send("POST", "/api/clinics", {}));

    expect(res.status).toBe(400);
  });

  it("nome com mais de 120 caracteres devolve 400", async () => {
    setScenario();

    const res = await POST(send("POST", "/api/clinics", { name: "x".repeat(121) }));

    expect(res.status).toBe(400);
  });

  it("cria a clínica com vínculo owner e devolve 201", async () => {
    setScenario({ insertClinicId: 42 });

    const res = await POST(send("POST", "/api/clinics", { name: "  Clínica Nova  " }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.clinic).toMatchObject({ id: 42, name: "Clínica Nova", role: "owner" });

    const clinicInsert = fakeSupabase.last("clinics", "insert");
    expect(clinicInsert?.payload).toMatchObject({ name: "Clínica Nova" });
    const memberInsert = fakeSupabase.last("clinic_members", "insert");
    expect(memberInsert?.payload).toMatchObject({
      clinic_id: 42,
      user_id: "user-1",
      role: "owner",
      active: true,
    });
    // Auditoria do evento.
    expect(fakeSupabase.last("audit_logs", "insert")?.payload).toMatchObject({
      action: "clinic.create",
      clinic_id: 42,
    });
  });

  it("falha no vínculo owner reverte a clínica criada (compensação)", async () => {
    setScenario({ insertClinicId: 42, memberInsertError: true });

    const res = await POST(send("POST", "/api/clinics", { name: "Clínica Nova" }));

    expect(res.status).toBe(500);
    // A clínica órfã é apagada: delete compensatório no mesmo id.
    const revert = fakeSupabase.last("clinics", "delete");
    expect(revert?.filters).toContain("id=42");
  });

  it("falha no insert da clínica devolve 500", async () => {
    setScenario({ insertClinicId: null });

    const res = await POST(send("POST", "/api/clinics", { name: "Clínica Nova" }));

    expect(res.status).toBe(500);
    expect(fakeSupabase.find("clinic_members", "insert")).toHaveLength(0);
  });
});

describe("PATCH /api/clinics/active", () => {
  it("sem sessão devolve 401", async () => {
    session.userId = null;
    setScenario();

    const res = await PATCH(send("PATCH", "/api/clinics/active", { clinicId: 7 }));

    expect(res.status).toBe(401);
  });

  it("clinicId inválido devolve 400", async () => {
    setScenario();

    for (const body of [{}, { clinicId: "abc" }, { clinicId: -1 }, { clinicId: null }]) {
      const res = await PATCH(send("PATCH", "/api/clinics/active", body));
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
  });

  it("sem vínculo na clínica devolve 403 (nunca troca de tenant)", async () => {
    setScenario({ memberships: [{ clinic_id: 3, role: "member", name: "A", subscriptionStatus: "active" }] });

    const res = await PATCH(send("PATCH", "/api/clinics/active", { clinicId: 99 }));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toContain("acesso");
    // Nada foi gravado.
    expect(fakeSupabase.find("user_active_clinic", "upsert")).toHaveLength(0);
  });

  it("troca a clínica: grava a preferência, o cookie e audita", async () => {
    setScenario();

    const res = await PATCH(
      send("PATCH", "/api/clinics/active", { clinicId: 7 }, { cookie: "sd_active_clinic=3" })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, clinicId: 7 });

    // Preferência persistida entre dispositivos.
    const upsert = fakeSupabase.last("user_active_clinic", "upsert");
    expect(upsert?.opts.onConflict).toBe("user_id");
    expect(upsert?.payload).toMatchObject({ user_id: "user-1", clinic_id: 7 });

    // Cookie httpOnly por dispositivo.
    const cookie = res.cookies.get("sd_active_clinic");
    expect(cookie?.value).toBe("7");
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.path).toBe("/");
    expect(cookie?.maxAge).toBeGreaterThan(0);

    // Auditoria com a clínica anterior (do cookie, já validada).
    expect(fakeSupabase.last("audit_logs", "insert")?.payload).toMatchObject({
      action: "clinic.switch",
      clinic_id: 7,
      meta: { from: 3 },
    });
  });

  it("falha ao guardar a preferência não impede a troca (cookie continua)", async () => {
    setScenario({ storedError: { message: "timeout" } });

    const res = await PATCH(send("PATCH", "/api/clinics/active", { clinicId: 7 }));

    expect(res.status).toBe(200);
    expect(res.cookies.get("sd_active_clinic")?.value).toBe("7");
    expect(console.error).toHaveBeenCalled();
  });

  it("erro na validação do vínculo devolve 500 fail-closed", async () => {
    fakeSupabase.setResolver((q) => {
      if (q.table === "clinic_members") return { error: { message: "timeout" } };
      return { data: q.opts.maybeSingle || q.opts.single ? null : [], count: 0, error: null };
    });

    const res = await PATCH(send("PATCH", "/api/clinics/active", { clinicId: 7 }));

    expect(res.status).toBe(500);
    expect(fakeSupabase.find("user_active_clinic", "upsert")).toHaveLength(0);
  });
});

describe("isSubscriptionExemptApi — /api/clinics", () => {
  it("rotas de clínicas ficam fora do gate de assinatura", async () => {
    const { isSubscriptionExemptApi } = await import("@/lib/api-auth");
    expect(isSubscriptionExemptApi("/api/clinics")).toBe(true);
    expect(isSubscriptionExemptApi("/api/clinics/active")).toBe(true);
  });
});
