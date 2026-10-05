import { describe, it, expect, vi, beforeEach } from "vitest";

// O supabase.js cria o client no import — precisa de env antes.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
});

// So as funcoes que tocam no banco sao substituidas; as regras puras
// (canCancel/canReschedule/checkWithinWorkingHours/...) seguem reais.
vi.mock("@/lib/services/appointments", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/services/appointments")>();
  return {
    ...actual,
    getAppointment: vi.fn(),
    cancelAppointment: vi.fn(),
    rescheduleAppointment: vi.fn(),
    getAvailableSlots: vi.fn(async () => []),
    createAppointment: vi.fn(),
    findUpcomingAppointmentByPhone: vi.fn(),
  };
});

import {
  checkWithinWorkingHours,
  enumerateSlots,
  isNoShowDue,
  canCancel,
  canReschedule,
  getAppointment,
  cancelAppointment,
  NO_SHOW_GRACE_MINUTES,
} from "@/lib/services/appointments";
import { executeTool } from "@/lib/agent/tools";
import type { Appointment, DoctorSchedule } from "@/lib/types";

const MONDAY = new Date(2026, 9, 5); // 05/10/2026 (segunda-feira)
const schedule: DoctorSchedule[] = [
  { weekday: 1, start_time: "08:00", end_time: "11:00" },
  { weekday: 3, start_time: "13:00", end_time: "17:00" },
];

function at(day: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m, 0, 0);
}

function makeAppointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: 1,
    patient_name: "Paciente Teste",
    patient_phone: "258840000000",
    specialty_id: 1,
    professional_id: "prof-1",
    starts_at: "2026-12-31 10:00",
    ends_at: "2026-12-31 10:30",
    status: "scheduled",
    reason: "",
    source: "ia",
    rescheduled: 0,
    reschedule_count: 0,
    conversation_id: null,
    cancelled_at: null,
    created_at: "2026-10-01 08:00",
    updated_at: "2026-10-01 08:00",
    ...overrides,
  };
}

// ── 3.6a: horario de funcionamento ───────────────────────────

describe("3.6a — horário de funcionamento", () => {
  it("aceita consulta que cabe inteira na janela do dia", () => {
    const r = checkWithinWorkingHours(schedule, at(MONDAY, "08:00"), at(MONDAY, "09:00"));
    expect(r.ok).toBe(true);
  });

  it("aceita consulta terminando exatamente no fim do expediente", () => {
    expect(checkWithinWorkingHours(schedule, at(MONDAY, "10:00"), at(MONDAY, "11:00")).ok).toBe(
      true
    );
  });

  it("recusa início antes da abertura", () => {
    const r = checkWithinWorkingHours(schedule, at(MONDAY, "07:30"), at(MONDAY, "08:30"));
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("expediente");
  });

  it("recusa término depois do fechamento", () => {
    const r = checkWithinWorkingHours(schedule, at(MONDAY, "10:30"), at(MONDAY, "11:30"));
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("08:00-11:00");
  });

  it("recusa dia sem expediente cadastrado", () => {
    const r = checkWithinWorkingHours(schedule, at(new Date(2026, 9, 6), "09:00"), at(new Date(2026, 9, 6), "10:00"));
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("não atende neste dia");
  });

  it("sem janela no dia: recusa (a agenda inteira vazia é tratada pelo chamador)", () => {
    expect(checkWithinWorkingHours([], at(MONDAY, "23:00"), at(MONDAY, "23:30")).ok).toBe(false);
  });
});

// ── 3.6d: passo dos slots = consultation_duration ────────────

describe("3.6d — passo dos slots pela duração da consulta", () => {
  const base = {
    specialtyId: 1,
    specialtyName: "Clínica Geral",
    professionalId: "prof-1",
    doctorName: "Dra. Ana",
    price: 100,
    schedule: [{ weekday: 1, start_time: "08:00", end_time: "11:00" }],
    weekday: 1,
    dayStart: MONDAY,
    minStart: new Date(2026, 9, 4, 0, 0), // ontem: libera todos
    busy: [],
  };

  it("com duração 60 o passo é 60 min (08:00, 09:00, 10:00)", () => {
    const slots = enumerateSlots({ ...base, durationMinutes: 60 });
    expect(slots.map((s) => s.starts_at.split(" ")[1])).toEqual(["08:00", "09:00", "10:00"]);
  });

  it("com duração 30 o passo é 30 min (6 slots de 08:00 a 10:30)", () => {
    const slots = enumerateSlots({ ...base, durationMinutes: 30 });
    expect(slots).toHaveLength(6);
    expect(slots[1].starts_at).toBe("2026-10-05 08:30");
    expect(slots[5].starts_at).toBe("2026-10-05 10:30");
  });

  it("nunca encaixa consulta que terminaria após o fechamento", () => {
    const slots = enumerateSlots({ ...base, durationMinutes: 90 });
    expect(slots.map((s) => s.starts_at.split(" ")[1])).toEqual(["08:00", "09:30"]);
    expect(slots.every((s) => s.ends_at <= "2026-10-05 11:00")).toBe(true);
  });

  it("janela ocupada derruba os slots que se sobrepõem", () => {
    const busy = [
      { professional_id: "prof-1", start: at(MONDAY, "09:00").getTime(), end: at(MONDAY, "10:00").getTime() },
    ];
    const slots = enumerateSlots({ ...base, durationMinutes: 60, busy });
    expect(slots.map((s) => s.starts_at.split(" ")[1])).toEqual(["08:00", "10:00"]);
  });

  it("slots antes do horário mínimo (agora + 2h) não aparecem", () => {
    const slots = enumerateSlots({ ...base, durationMinutes: 60, minStart: at(MONDAY, "09:01") });
    expect(slots.map((s) => s.starts_at.split(" ")[1])).toEqual(["10:00"]);
  });
});

// ── 3.6b: corte de 4h só via humano ──────────────────────────

describe("3.6b — janela de 4h e limite de remarcação", () => {
  it("mais de 4h de antecedência: cancelamento liberado", () => {
    expect(canCancel(makeAppointment({ starts_at: "2099-01-01 10:00" }))).toEqual({ ok: true });
  });

  it("menos de 4h: bloqueado e marcado como requiresHuman", () => {
    const soon = new Date(Date.now() + 2 * 3600_000);
    const starts = `${soon.getFullYear()}-${String(soon.getMonth() + 1).padStart(2, "0")}-${String(
      soon.getDate()
    ).padStart(2, "0")} ${String(soon.getHours()).padStart(2, "0")}:${String(
      soon.getMinutes()
    ).padStart(2, "0")}`;
    const r = canCancel(makeAppointment({ starts_at: starts }));
    expect(r.ok).toBe(false);
    expect(r.requiresHuman).toBe(true);
    expect(r.reason).toContain("4 horas");
  });

  it("consulta já cancelada: bloqueado SEM requiresHuman (não é caso de recepção)", () => {
    const r = canCancel(makeAppointment({ status: "cancelled" }));
    expect(r.ok).toBe(false);
    expect(r.requiresHuman).toBeUndefined();
  });

  it("remarcação já usada: bloqueado e marcado como requiresHuman", () => {
    const r = canReschedule(makeAppointment({ reschedule_count: 1 }));
    expect(r.ok).toBe(false);
    expect(r.requiresHuman).toBe(true);
    expect(r.reason).toContain("remarcada");
  });

  it("remarcação com 1 usada e 4h ok: segue bloqueado por limite", () => {
    const r = canReschedule(makeAppointment({ reschedule_count: 1, starts_at: "2099-01-01 10:00" }));
    expect(r.ok).toBe(false);
    expect(r.requiresHuman).toBe(true);
  });
});

// ── 3.6c: liberação de horário em no-show ────────────────────

describe("3.6c — no-show", () => {
  it("grace de 30 min", () => {
    expect(NO_SHOW_GRACE_MINUTES).toBe(30);
  });

  it("consulta em andamento (começou há 10 min) ainda não é no-show", () => {
    const now = new Date(2026, 9, 5, 10, 10);
    expect(isNoShowDue("2026-10-05 10:00", now)).toBe(false);
  });

  it("passou do grace: vira no-show e o horário é liberado", () => {
    const now = new Date(2026, 9, 5, 10, 31);
    expect(isNoShowDue("2026-10-05 10:00", now)).toBe(true);
  });

  it("limite exato do grace não conta (30 min cheios)", () => {
    const now = new Date(2026, 9, 5, 10, 30);
    expect(isNoShowDue("2026-10-05 10:00", now)).toBe(false);
  });

  it("data inválida não dispara no-show", () => {
    expect(isNoShowDue("data-invalida", new Date())).toBe(false);
  });
});

// ── 3.7: confirmação em duas etapas ──────────────────────────

const ctx = { conversationId: 7 };

function futureStart(minutesFromNow: number): string {
  const d = new Date(Date.now() + minutesFromNow * 60_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

beforeEach(() => {
  vi.mocked(getAppointment).mockReset();
  vi.mocked(cancelAppointment).mockReset();
  vi.mocked(cancelAppointment).mockResolvedValue({} as never);
});

describe("3.7 — cancel_appointment em duas etapas", () => {
  it("etapa 1 (sem confirm): valida regras e NÃO executa", async () => {
    vi.mocked(getAppointment).mockResolvedValue(
      makeAppointment({ starts_at: futureStart(60 * 24) })
    );

    const result = await executeTool("cancel_appointment", { appointment_id: 1 }, ctx);
    const body = JSON.parse(result.output);

    expect(body.needs_confirmation).toBe(true);
    expect(body.summary.appointment_id).toBe(1);
    expect(body.message).toContain("confirm=true");
    expect(cancelAppointment).not.toHaveBeenCalled();
  });

  it("etapa 2 (confirm=true): executa o cancelamento", async () => {
    vi.mocked(getAppointment).mockResolvedValue(
      makeAppointment({ starts_at: futureStart(60 * 24) })
    );

    const result = await executeTool(
      "cancel_appointment",
      { appointment_id: 1, confirm: true },
      ctx
    );
    const body = JSON.parse(result.output);

    expect(body.ok).toBe(true);
    expect(cancelAppointment).toHaveBeenCalledWith(1);
  });

  it("fora da janela de 4h (sem confirm): exige humano, não pede confirmação", async () => {
    vi.mocked(getAppointment).mockResolvedValue(
      makeAppointment({ starts_at: futureStart(60 * 2) })
    );

    const result = await executeTool("cancel_appointment", { appointment_id: 1 }, ctx);
    const body = JSON.parse(result.output);

    expect(body.requires_human).toBe(true);
    expect(body.needs_confirmation).toBeUndefined();
    expect(body.hint).toContain("transfer_to_human");
    expect(cancelAppointment).not.toHaveBeenCalled();
  });

  it("fora da janela de 4h (com confirm=true): continua bloqueado", async () => {
    vi.mocked(getAppointment).mockResolvedValue(
      makeAppointment({ starts_at: futureStart(60 * 2) })
    );

    const result = await executeTool(
      "cancel_appointment",
      { appointment_id: 1, confirm: true },
      ctx
    );
    const body = JSON.parse(result.output);

    expect(body.requires_human).toBe(true);
    expect(cancelAppointment).not.toHaveBeenCalled();
  });

  it("consulta inexistente devolve erro estruturado", async () => {
    vi.mocked(getAppointment).mockResolvedValue(null);

    const result = await executeTool("cancel_appointment", { appointment_id: 999 }, ctx);
    expect(JSON.parse(result.output).error).toContain("não encontrada");
    expect(cancelAppointment).not.toHaveBeenCalled();
  });
});
