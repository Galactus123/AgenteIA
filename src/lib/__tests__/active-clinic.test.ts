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
import { NextResponse } from "next/server";
import {
  ACTIVE_CLINIC_COOKIE,
  parseActiveClinicId,
  preferredClinicIdFromRequest,
  resolveClinicIdByUserId,
  requireClinic,
} from "@/lib/api-auth";

// ── Clínica ativa do utilizador (Fase 1 multi-clínica) ──────────────────────
//
// resolveClinicIdByUserId lê a preferência em duas fontes — cookie
// sd_active_clinic (por dispositivo) e user_active_clinic (por conta) — e
// valida CADA apontamento contra clinic_members do próprio user_id antes de
// usá-lo. Preferência inválida é ignorada e cai no legado (menor clinic_id
// ativo): nunca troca por uma clínica à qual o utilizador não pertence.

// cenário com 2+ clínicas: membership define quem o user pode ver; stored é a
// linha de user_active_clinic; storedError simula a tabela ausente (PGRST205).
function setScenario(opts: {
  memberships?: number[];
  stored?: number | null;
  storedError?: { message: string; code?: string } | null;
} = {}): void {
  const memberships = opts.memberships ?? [3, 7];
  const stored = "stored" in opts ? opts.stored : null;
  fakeSupabase.setResolver((q) => {
    if (q.table === "user_active_clinic") {
      if (opts.storedError) return { error: opts.storedError };
      return { data: stored === null ? null : { clinic_id: stored } };
    }
    if (q.table === "clinic_members") {
      // Consulta pontual (maybeSingle + filtro clinic_id): validação de um
      // apontamento específico.
      const clinicFilter = q.filters.find((f) => f.startsWith("clinic_id="));
      if (clinicFilter) {
        const id = Number(clinicFilter.slice("clinic_id=".length));
        return { data: memberships.includes(id) ? { clinic_id: id } : null };
      }
      // Fallback legado: menor clinic_id ativo.
      const lowest = [...memberships].sort((a, b) => a - b)[0];
      return { data: lowest === undefined ? null : { clinic_id: lowest } };
    }
    if (q.table === "subscriptions") return { data: [{ id: "sub-1", clinic_id: 7, plan_id: "pro", status: "active" }] };
    if (q.table === "clinics") return { data: [{ id: 7 }] };
    return { data: q.opts.maybeSingle || q.opts.single ? null : [], count: 0, error: null };
  });
}

function apiRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("https://syncbot.test/api/pacientes", { headers });
}

beforeEach(() => {
  fakeSupabase.reset();
  session.userId = "user-1";
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("parseActiveClinicId", () => {
  it("aceita inteiros positivos curtos (vindos de cookie/corpo)", () => {
    expect(parseActiveClinicId("7")).toBe(7);
    expect(parseActiveClinicId("1")).toBe(1);
    expect(parseActiveClinicId("1234567890")).toBe(1234567890);
  });

  it("rejeita vazio, zero, negativo, não numérico e exagerado", () => {
    expect(parseActiveClinicId(null)).toBeNull();
    expect(parseActiveClinicId(undefined)).toBeNull();
    expect(parseActiveClinicId("")).toBeNull();
    expect(parseActiveClinicId("0")).toBeNull();
    expect(parseActiveClinicId("-7")).toBeNull();
    expect(parseActiveClinicId("7abc")).toBeNull();
    expect(parseActiveClinicId("12.5")).toBeNull();
    expect(parseActiveClinicId("0x7")).toBeNull();
    expect(parseActiveClinicId("12345678901")).toBeNull(); // 11 dígitos
    expect(parseActiveClinicId("1e9")).toBeNull();
  });
});

describe("preferredClinicIdFromRequest", () => {
  it("lê o cookie sd_active_clinic", () => {
    const req = new NextRequest("https://syncbot.test/api/x", {
      headers: { cookie: `${ACTIVE_CLINIC_COOKIE}=12` },
    });
    expect(preferredClinicIdFromRequest(req)).toBe(12);
  });

  it("cookie ausente ou inválido devolve null", () => {
    expect(preferredClinicIdFromRequest(apiRequest())).toBeNull();
    const invalid = new NextRequest("https://syncbot.test/api/x", {
      headers: { cookie: `${ACTIVE_CLINIC_COOKIE}=abc` },
    });
    expect(preferredClinicIdFromRequest(invalid)).toBeNull();
  });
});

describe("resolveClinicIdByUserId", () => {
  it("cookie com vínculo ativo é usado direto (sem ler a tabela)", async () => {
    setScenario({ memberships: [3, 7], stored: null });

    const clinicId = await resolveClinicIdByUserId("user-1", 7);

    expect(clinicId).toBe(7);
    expect(fakeSupabase.find("user_active_clinic")).toHaveLength(0);
    // Só a validação pontual — nunca o fallback limit(1).
    expect(fakeSupabase.find("clinic_members")).toHaveLength(1);
  });

  it("cookie sem vínculo é ignorado e cai no legado (nunca troca de tenant)", async () => {
    setScenario({ memberships: [3, 7], stored: null });

    // 99 não está em clinic_members do user.
    const clinicId = await resolveClinicIdByUserId("user-1", 99);

    expect(clinicId).toBe(3); // menor clinic_id ativo
    const fallback = fakeSupabase.find("clinic_members").pop();
    expect(fallback?.filters).toContain("limit:1");
  });

  it("preferência persistida com vínculo vale quando não há cookie", async () => {
    setScenario({ memberships: [3, 7], stored: 7 });

    const clinicId = await resolveClinicIdByUserId("user-1");

    expect(clinicId).toBe(7);
    expect(fakeSupabase.find("user_active_clinic")).toHaveLength(1);
  });

  it("preferência persistida sem vínculo também é ignorada", async () => {
    setScenario({ memberships: [3, 7], stored: 99 });

    const clinicId = await resolveClinicIdByUserId("user-1");

    expect(clinicId).toBe(3);
  });

  it("sem nenhuma preferência usa o menor clinic_id ativo (legado)", async () => {
    setScenario({ memberships: [7, 3], stored: null });

    const clinicId = await resolveClinicIdByUserId("user-1");

    expect(clinicId).toBe(3);
  });

  it("sem vínculos ativos devolve null (o chamador faz o gate)", async () => {
    setScenario({ memberships: [], stored: null });

    await expect(resolveClinicIdByUserId("user-1")).resolves.toBeNull();
  });

  it("tabela user_active_clinic ainda não migrada (PGRST205) cai no legado em silêncio", async () => {
    setScenario({
      memberships: [3, 7],
      storedError: { message: 'relation "user_active_clinic" does not exist', code: "PGRST205" },
    });

    const clinicId = await resolveClinicIdByUserId("user-1");

    expect(clinicId).toBe(3);
    expect(console.error).not.toHaveBeenCalled();
  });

  it("outro erro na tabela é registado mas não quebra a resolução", async () => {
    setScenario({
      memberships: [3, 7],
      storedError: { message: "timeout" },
    });

    const clinicId = await resolveClinicIdByUserId("user-1");

    expect(clinicId).toBe(3);
    expect(console.error).toHaveBeenCalled();
  });

  it("fila de validação: cookie → tabela → fallback, sempre validado em clinic_members", async () => {
    setScenario({ memberships: [7], stored: 99 });

    // Cookie inválido (50) e tabela inválida (99): ambos validados e
    // descartados; só o fallback (7) passa.
    const clinicId = await resolveClinicIdByUserId("user-1", 50);

    expect(clinicId).toBe(7);
    const memberQueries = fakeSupabase.find("clinic_members");
    // 2 validações pontuais (50 e 99) + fallback.
    expect(memberQueries).toHaveLength(3);
    expect(memberQueries[0].filters).toContain("clinic_id=50");
    expect(memberQueries[1].filters).toContain("clinic_id=99");
  });
});

describe("requireClinic com cookie sd_active_clinic", () => {
  it("cookie validado troca o contexto para a clínica escolhida", async () => {
    setScenario({ memberships: [3, 7], stored: null });

    const res = await requireClinic(apiRequest({ cookie: `${ACTIVE_CLINIC_COOKIE}=7` }));

    expect(res).not.toBeInstanceOf(NextResponse);
    expect(res).toMatchObject({ clinicId: 7, user: { id: "user-1" } });
  });

  it("cookie de clínica alheia é ignorado e o contexto fica no legado", async () => {
    setScenario({ memberships: [3, 7], stored: null });

    const res = await requireClinic(apiRequest({ cookie: `${ACTIVE_CLINIC_COOKIE}=99` }));

    expect(res).toMatchObject({ clinicId: 3 });
  });
});
