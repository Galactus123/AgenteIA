import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import type { FakeQuery } from "@/lib/__tests__/helpers/supabase-fake";

vi.mock("@/lib/supabase", async () => {
  const { fakeSupabase } = await import("@/lib/__tests__/helpers/supabase-fake");
  return { supabaseAdmin: fakeSupabase.admin };
});

// Sessão da rota: requireClinic é o único caminho de obtenção do clinic_id.
// O teste controla a sessão e o caso de "sem clínica vinculada".
const auth = vi.hoisted((): { clinicId: number | null } => ({ clinicId: 7 }));
vi.mock("@/lib/api-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-auth")>();
  const { NextResponse: Response } = await import("next/server");
  return {
    ...actual,
    getUser: async () => ({ id: "user-1", email: "dono@clinica.com" }),
    requireClinic: async () => {
      if (auth.clinicId === null) {
        return Response.json({ error: "Sem clínica vinculada a esta conta." }, { status: 403 });
      }
      return { user: { id: "user-1" }, clinicId: auth.clinicId };
    },
  };
});

import { fakeSupabase } from "@/lib/__tests__/helpers/supabase-fake";
import { GET as listPacientes, POST as createPaciente } from "./pacientes/route";
import { GET as getPaciente } from "./pacientes/[id]/route";
import { GET as getStats } from "./stats/route";
import { GET as listConversas } from "./conversations/route";
import { GET as listNotificacoes } from "./notifications/route";
import { PATCH as patchNotificacao } from "./notifications/[id]/route";
import { GET as listEspecialidades } from "./especialidades/route";
import { GET as listAgenda, POST as createConsulta } from "./appointments/route";

// ── Isolamento multi-tenant das rotas do painel ─────────────────────────────
//
// Todo clinic_id vem do requireClinic (sessão, servidor): leituras filtram,
// escritas gravam a clínica do próprio utilizador e ids de outra clínica
// respondem 404 — sem vazar existência de recursos alheios.

const CLINIC = 7;

function get(path: string): NextRequest {
  return new NextRequest(`https://syncbot.test${path}`);
}

function send(
  method: "POST" | "PATCH",
  path: string,
  body: unknown
): NextRequest {
  return new NextRequest(`https://syncbot.test${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function params(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

function rows(...tablesWithRow: string[]): void {
  const rowsSet = new Set(tablesWithRow);
  fakeSupabase.setResolver((q) => {
    if (rowsSet.has(q.table)) return { data: { id: 10 } };
    return defaultResult(q);
  });
}

function defaultResult(q: FakeQuery) {
  return { data: q.opts.maybeSingle || q.opts.single ? null : [], count: 0, error: null };
}

// Toda leitura de uma tabela com clinic_id tem de filtrar pela sessão.
function expectScoped(table: string): void {
  const queries = fakeSupabase.find(table, "select");
  expect(queries.length, `nenhuma leitura em ${table}`).toBeGreaterThan(0);
  for (const q of queries) {
    expect(q.filters, `${table}: ${q.filters.join(" ")}`).toContain(`clinic_id=${CLINIC}`);
  }
}

beforeEach(() => {
  fakeSupabase.reset();
  auth.clinicId = CLINIC;
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("sessão sem clínica vinculada", () => {
  it("403 em qualquer rota e nada é lido nem escrito", async () => {
    auth.clinicId = null;

    const res = await listPacientes(get("/api/pacientes"));

    expect(res.status).toBe(403);
    expect((await res.json()).error).toContain("clínica");
    expect(fakeSupabase.queries).toHaveLength(0);
  });
});

describe("GET /api/pacientes", () => {
  it("filtra a listagem pela clínica da sessão", async () => {
    const res = await listPacientes(get("/api/pacientes"));

    expect(res.status).toBe(200);
    expectScoped("patients");
  });

  it("a busca por telefone também fica na clínica da sessão", async () => {
    fakeSupabase.setResolver((q) =>
      q.opts.maybeSingle ? { data: { id: 1, name: "Maria" } } : defaultResult(q)
    );

    const res = await listPacientes(get("/api/pacientes?phone=841234567"));

    expect(res.status).toBe(200);
    expectScoped("patients");
    expect(fakeSupabase.last("patients", "select")?.filters).toContain("phone=841234567");
  });
});

describe("POST /api/pacientes", () => {
  it("grava clinic_id da sessão e ignora um clinic_id do corpo", async () => {
    rows("patients");

    const res = await createPaciente(
      send("POST", "/api/pacientes", {
        name: "Maria Silva",
        phone: "841234567",
        clinic_id: 99,
      })
    );

    expect(res.status).toBe(201);
    const insert = fakeSupabase.last("patients", "insert");
    expect(insert?.payload).toMatchObject({ clinic_id: CLINIC, name: "Maria Silva" });

    // A trilha de auditoria nasce na mesma clínica.
    const audit = fakeSupabase.last("audit_logs", "insert");
    expect(audit?.payload).toMatchObject({ clinic_id: CLINIC, action: "patient.create" });
  });
});

describe("GET /api/pacientes/[id]", () => {
  it("id de outra clínica responde 404 sem confirmar a existência", async () => {
    fakeSupabase.setResolver((q) =>
      q.opts.single
        ? { data: null, error: { message: "PGRST116" } }
        : defaultResult(q)
    );

    const res = await getPaciente(get("/api/pacientes/5"), params("5"));

    expect(res.status).toBe(404);
    const q = fakeSupabase.last("patients", "select");
    expect(q?.filters).toContain("id=5");
    expect(q?.filters).toContain(`clinic_id=${CLINIC}`);
  });

  it("id da própria clínica devolve a linha", async () => {
    fakeSupabase.setResolver((q) =>
      q.opts.single ? { data: { id: 5, name: "Maria" } } : defaultResult(q)
    );

    const res = await getPaciente(get("/api/pacientes/5"), params("5"));

    expect(res.status).toBe(200);
    expect(fakeSupabase.last("patients", "select")?.filters).toContain(`clinic_id=${CLINIC}`);
  });
});

describe("GET /api/stats", () => {
  it("todas as agregações ficam limitadas à clínica da sessão", async () => {
    const res = await getStats(get("/api/stats"));

    expect(res.status).toBe(200);

    const scopedTables = new Set([
      "patients",
      "appointments",
      "conversations",
      "professionals",
      "messages",
    ]);
    const scoped = fakeSupabase.queries.filter((q) => scopedTables.has(q.table));
    expect(scoped.length).toBeGreaterThan(0);
    for (const q of scoped) {
      // messages não tem clinic_id: o filtro passa pelo join com a conversa.
      const scopedFilter =
        q.table === "messages" ? `conversations.clinic_id=${CLINIC}` : `clinic_id=${CLINIC}`;
      expect(q.filters, `${q.table}: ${q.filters.join(" ")}`).toContain(scopedFilter);
    }
  });
});

describe("GET /api/conversations", () => {
  it("a lista de conversas filtra pela clínica da sessão", async () => {
    const res = await listConversas(get("/api/conversations"));

    expect(res.status).toBe(200);
    expectScoped("conversations");
  });

  it("id de conversa de outra clínica responde 404", async () => {
    fakeSupabase.setResolver((q) =>
      q.opts.maybeSingle ? { data: null } : defaultResult(q)
    );

    const res = await listConversas(get("/api/conversations?id=9"));

    expect(res.status).toBe(404);
    const q = fakeSupabase.last("conversations", "select");
    expect(q?.filters).toContain("id=9");
    expect(q?.filters).toContain(`clinic_id=${CLINIC}`);
  });
});

describe("GET /api/notifications", () => {
  it("listagem e contador de não lidas usam a clínica da sessão", async () => {
    const res = await listNotificacoes(get("/api/notifications"));

    expect(res.status).toBe(200);
    expectScoped("notifications");
  });
});

describe("PATCH /api/notifications/[id]", () => {
  it("o update filtra por clínica e 404 quando não há linha da sessão", async () => {
    const res = await patchNotificacao(send("PATCH", "/api/notifications/3", {}), params("3"));

    expect(res.status).toBe(404);
    const update = fakeSupabase.last("notifications", "update");
    expect(update?.filters).toContain("id=3");
    expect(update?.filters).toContain(`clinic_id=${CLINIC}`);
  });
});

describe("GET /api/especialidades", () => {
  it("o catálogo de especialidades é o da clínica da sessão", async () => {
    const res = await listEspecialidades(get("/api/especialidades"));

    expect(res.status).toBe(200);
    expectScoped("specialties");
  });
});

describe("GET /api/appointments", () => {
  it("a agenda filtrada carrega clinic_id da sessão", async () => {
    const res = await listAgenda(get("/api/appointments?date=2030-01-05"));

    expect(res.status).toBe(200);
    expectScoped("appointments");
  });
});

describe("POST /api/appointments", () => {
  it("especialidade de outra clínica: 404 e nada agendado", async () => {
    fakeSupabase.setResolver((q) => {
      if (q.table === "specialties") return { data: null };
      return defaultResult(q);
    });

    const res = await createConsulta(send("POST", "/api/appointments", bookingBody()));

    expect(res.status).toBe(404);
    expect((await res.json()).error).toContain("Especialidade");
    expect(fakeSupabase.find("appointments", "insert")).toHaveLength(0);
  });

  it("profissional de outra clínica: 404 e nada agendado", async () => {
    fakeSupabase.setResolver((q) => {
      if (q.table === "specialties") return { data: { id: 1, name: "Cardiologia" } };
      if (q.table === "professionals" && q.opts.maybeSingle) return { data: null };
      return defaultResult(q);
    });

    const res = await createConsulta(send("POST", "/api/appointments", bookingBody()));

    expect(res.status).toBe(404);
    expect((await res.json()).error).toContain("Médico");
    expect(fakeSupabase.find("appointments", "insert")).toHaveLength(0);
  });

  it("agenda com clinic_id da sessão mesmo com clinic_id no corpo", async () => {
    fakeSupabase.setResolver((q) => {
      if (q.table === "specialties") return { data: { id: 1, name: "Cardiologia" } };
      if (q.table === "professionals") {
        return { data: { id: "doc-1", name: "Dr. Ana", consultation_duration: 30, price: 500 } };
      }
      if (q.table === "appointments") {
        if (q.op === "insert") return { data: { id: 10 } };
        // Leitura pontual (id=) devolve a view; o resto é lista (conflitos).
        if (q.filters.some((f) => f.startsWith("id="))) return { data: [appointmentView()] };
        return { data: [] };
      }
      return defaultResult(q);
    });

    const res = await createConsulta(
      send("POST", "/api/appointments", { ...bookingBody(), clinic_id: 99 })
    );

    expect(res.status).toBe(201);
    const insert = fakeSupabase.last("appointments", "insert");
    expect(insert?.payload).toMatchObject({ clinic_id: CLINIC, source: "api" });
  });
});

function bookingBody(): Record<string, unknown> {
  return {
    patient_name: "Maria Silva",
    patient_phone: "841234567",
    specialty_id: 1,
    professional_id: "doc-1",
    starts_at: "2030-01-05 10:00",
    reason: "Check-up",
  };
}

function appointmentView(): Record<string, unknown> {
  return {
    id: 10,
    patient_name: "Maria Silva",
    patient_phone: "841234567",
    specialty_id: 1,
    professional_id: "doc-1",
    starts_at: "2030-01-05 10:00",
    ends_at: "2030-01-05 10:30",
    status: "scheduled",
    reason: "Check-up",
    source: "api",
    rescheduled: 0,
    reschedule_count: 0,
    conversation_id: null,
    cancelled_at: null,
    created_at: "2030-01-01 00:00",
    updated_at: "2030-01-01 00:00",
    specialty_name: "Cardiologia",
    doctor_name: "Dr. Ana",
    clinic_name: "Clínica Central",
    clinic_address: "Av. 123",
    consultation_duration: 30,
    price: 500,
  };
}
