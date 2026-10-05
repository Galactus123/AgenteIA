import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const inserted: { table: string; values: Record<string, unknown> }[] = [];
const state = {
  insertError: null as { message: string } | null,
  listError: null as { message: string } | null,
  listRows: [] as Record<string, unknown>[],
  lastLimit: 0,
  listCalls: 0,
};

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key-de-teste";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key-de-teste";
});

function builder(table: string) {
  let mode: "none" | "insert" | "list" = "none";
  const b: Record<string, unknown> = {};
  b.insert = (values: Record<string, unknown>) => {
    mode = "insert";
    inserted.push({ table, values });
    return b;
  };
  b.select = () => {
    if (mode === "none") mode = "list";
    return b;
  };
  b.eq = () => b;
  b.order = () => b;
  b.limit = (n: number) => {
    state.lastLimit = n;
    return b;
  };
  b.then = (
    onOk: (v: unknown) => unknown,
    onErr?: (e: unknown) => unknown
  ) => {
    if (mode === "insert") {
      return Promise.resolve({ data: null, error: state.insertError }).then(onOk, onErr);
    }
    state.listCalls += 1;
    return Promise.resolve(
      state.listError ? { data: null, error: state.listError } : { data: state.listRows, error: null }
    ).then(onOk, onErr);
  };
  return b;
}

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: (table: string) => builder(table) },
}));

const getUserMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api-auth", () => ({
  getUser: getUserMock,
}));

vi.mock("@/lib/services/clinics", () => ({
  getDefaultClinicId: vi.fn(async () => 7),
}));

import { recordAudit, auditRequest, listAuditLogs } from "@/lib/services/audit";

beforeEach(() => {
  inserted.length = 0;
  state.insertError = null;
  state.listError = null;
  state.listRows = [];
  state.lastLimit = 0;
  state.listCalls = 0;
  getUserMock.mockReset();
  getUserMock.mockResolvedValue({ id: "u1", email: "Admin@Clinica.com" });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("recordAudit (Fase 6.3)", () => {
  it("grava evento com clínica padrão e campos nulos quando ausentes", async () => {
    await recordAudit({ action: "auth.login" });

    expect(inserted).toHaveLength(1);
    expect(inserted[0].table).toBe("audit_logs");
    expect(inserted[0].values).toMatchObject({
      clinic_id: 7,
      action: "auth.login",
      actor_id: null,
      actor_label: null,
      entity: null,
      entity_id: null,
      meta: null,
      ip: null,
    });
  });

  it("converte entityId para string e aceita clinicId explicito", async () => {
    await recordAudit({
      action: "appointment.create",
      clinicId: 3,
      entity: "appointments",
      entityId: 42,
      meta: { source: "panel" },
    });

    expect(inserted[0].values).toMatchObject({
      clinic_id: 3,
      entity_id: "42",
      meta: { source: "panel" },
    });
  });

  it("nunca lança quando o insert falha", async () => {
    state.insertError = { message: "banco indisponivel" };
    await expect(recordAudit({ action: "auth.login" })).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });

  it("nunca lança quando a resolução da clínica falha", async () => {
    const clinics = await import("@/lib/services/clinics");
    vi.mocked(clinics.getDefaultClinicId).mockRejectedValueOnce(new Error("sem rede"));
    await expect(recordAudit({ action: "auth.login" })).resolves.toBeUndefined();
    expect(inserted).toHaveLength(0);
  });
});

describe("auditRequest (Fase 6.3)", () => {
  function request(): NextRequest {
    return new NextRequest("http://localhost/api/x", {
      headers: { "x-forwarded-for": "203.0.113.9" },
    });
  }

  it("resolve o usuário da sessão e mascara o e-mail", async () => {
    await auditRequest(request(), { action: "patient.create", entity: "patients", entityId: 5 });

    expect(getUserMock).toHaveBeenCalled();
    expect(inserted[0].values).toMatchObject({
      actor_id: "u1",
      actor_label: "A***@C***.com",
      action: "patient.create",
      entity_id: "5",
      ip: "203.0.113.9",
    });
    // PII crua jamais vai para a trilha.
    expect(JSON.stringify(inserted[0].values)).not.toContain("Admin@Clinica.com");
  });

  it("usa o usuário repassado sem chamar o getUser", async () => {
    await auditRequest(request(), {
      action: "auth.login",
      user: { id: "u9", email: "x@y.com" } as never,
    });

    expect(getUserMock).not.toHaveBeenCalled();
    expect(inserted[0].values).toMatchObject({ actor_id: "u9" });
  });

  it("grava evento sem ator quando nao ha sessao", async () => {
    getUserMock.mockResolvedValue(null);
    await auditRequest(request(), { action: "auth.login_failed" });
    expect(inserted[0].values).toMatchObject({ actor_id: null, actor_label: null });
  });

  it("nunca lança quando o getUser rejeita", async () => {
    getUserMock.mockRejectedValue(new Error("sessao expirada"));
    await expect(auditRequest(request(), { action: "auth.login" })).resolves.toBeUndefined();
  });
});

describe("listAuditLogs (Fase 6.3)", () => {
  it("devolve as linhas e respeita o limite (clamp 1..500)", async () => {
    state.listRows = [{ id: 1, action: "auth.login" }];
    const rows = await listAuditLogs({ clinicId: 2, limit: 5000 });
    expect(rows).toHaveLength(1);
    expect(state.lastLimit).toBe(500);
    expect(state.listCalls).toBe(1);

    await listAuditLogs({ limit: 0 });
    expect(state.lastLimit).toBe(1);
  });

  it("devolve [] e loga quando a consulta falha", async () => {
    state.listError = { message: "timeout" };
    const rows = await listAuditLogs();
    expect(rows).toEqual([]);
    expect(console.error).toHaveBeenCalled();
  });
});
