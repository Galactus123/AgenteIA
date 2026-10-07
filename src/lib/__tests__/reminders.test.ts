import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Lembretes (Fase 8.3): janelas 24h/2h, idempotencia do upsert, rollback
// quando a fila cai e erros de banco — tudo contra o harness fake de
// supabase, com a fila parada (processOutboxInBackground) e sem Komunika.
vi.mock("@/lib/supabase", async () => {
  const { fakeSupabase } = await import("./helpers/supabase-fake");
  return { supabaseAdmin: fakeSupabase.admin };
});

const outbox = vi.hoisted(() => ({ processOutboxInBackground: vi.fn() }));
vi.mock("@/lib/services/outbox", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/services/outbox")>();
  return { ...actual, processOutboxInBackground: outbox.processOutboxInBackground };
});

const notify = vi.hoisted(() => ({ notifyDoctorReminder: vi.fn(async () => undefined) }));
vi.mock("@/lib/services/notifications", () => ({
  notifyDoctorReminder: notify.notifyDoctorReminder,
}));

import { fakeSupabase, type FakeQuery } from "./helpers/supabase-fake";
import { runReminderCheck } from "@/lib/services/reminders";

const NOW = new Date("2026-10-05T10:00:00");

function appointmentRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 1,
    clinic_id: 4,
    patient_name: "Maria Silva",
    patient_phone: "841234567",
    professional_id: null,
    conversation_id: null,
    starts_at: "2026-10-06 10:00",
    status: "scheduled",
    specialties: { name: "Cardiologia" },
    professionals: {
      name: "Dr. Simao",
      consultation_duration: 30,
      price: 500,
      phone: "+258 84 999 0000",
    },
    clinics: { name: "Clinica Central", address: "Av. 123" },
    ...overrides,
  };
}

// Roteador padrao: consultas de leitura devolvem a linha de appointment;
// escritas respondem o minimo para a cadeia seguir.
function baseResolver(rows: Record<string, unknown>[]) {
  return (q: FakeQuery) => {
    switch (q.table) {
      case "appointments":
        return { data: rows, error: null };
      case "reminders":
        if (q.op === "upsert") return { data: [{ id: 11 }], error: null };
        return { data: null, error: null };
      case "conversations":
        if (q.op === "select") return { data: null, error: null };
        if (q.op === "insert")
          return { data: { id: 77, phone: "841234567", status: "open" }, error: null };
        return { data: null, error: null };
      case "outbox":
        if (q.op === "insert") return { data: { id: 55 }, error: null };
        return { data: null, error: null };
      case "messages":
        if (q.op === "insert")
          return { data: { id: 1, conversation_id: 77, sender: "bot", content: "x" }, error: null };
        return { data: null, error: null };
      case "professionals":
        return { data: null, error: null };
      default:
        return undefined;
    }
  };
}

describe("runReminderCheck (Fase 8.3)", () => {
  beforeEach(() => {
    fakeSupabase.reset();
    outbox.processOutboxInBackground.mockClear();
    notify.notifyDoctorReminder.mockClear();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => vi.restoreAllMocks());

  it("agenda na janela de 24h: registra o lembrete, enfileira e grava no historico", async () => {
    fakeSupabase.setResolver(baseResolver([appointmentRow({ starts_at: "2026-10-06 10:00" })]));

    const sent = await runReminderCheck(NOW);

    expect(sent).toBe(1);
    const upsert = fakeSupabase.last("reminders", "upsert");
    expect(upsert?.payload).toMatchObject({ appointment_id: 1, type: "24h" });
    expect(upsert?.opts).toMatchObject({ onConflict: "appointment_id,type", ignoreDuplicates: true });

    const enqueue = fakeSupabase.last("outbox", "insert");
    expect(enqueue?.payload).toMatchObject({ kind: "reminder", conversation_id: 77, phone: "841234567" });
    expect(String((enqueue?.payload as { text: string }).text)).toContain("amanhã");
    expect(String((enqueue?.payload as { text: string }).text)).toContain("às 10:00");

    const msg = fakeSupabase.last("messages", "insert");
    expect(msg?.payload).toMatchObject({ conversation_id: 77, sender: "bot" });
    expect(outbox.processOutboxInBackground).toHaveBeenCalledTimes(1);
  });

  it("agenda na janela de 2h (24h cai fora) e usa o texto 'hoje'", async () => {
    fakeSupabase.setResolver(baseResolver([appointmentRow({ starts_at: "2026-10-05 12:00" })]));

    const sent = await runReminderCheck(NOW);

    expect(sent).toBe(1);
    const upsert = fakeSupabase.last("reminders", "upsert");
    expect(upsert?.payload).toMatchObject({ type: "2h" });
    const enqueue = fakeSupabase.last("outbox", "insert");
    expect(String((enqueue?.payload as { text: string }).text)).toContain("hoje");
  });

  it("fora das janelas (5h) nao envia nada", async () => {
    fakeSupabase.setResolver(baseResolver([appointmentRow({ starts_at: "2026-10-05 15:00" })]));

    const sent = await runReminderCheck(NOW);

    expect(sent).toBe(0);
    expect(fakeSupabase.find("reminders", "upsert")).toHaveLength(0);
    expect(fakeSupabase.find("outbox", "insert")).toHaveLength(0);
    expect(outbox.processOutboxInBackground).toHaveBeenCalledTimes(1);
  });

  it("limites exatos das janelas: lado de fora fica de fora, lado de dentro entra", async () => {
    for (const [startsAt, expected] of [
      ["2026-10-06 09:24", 0], // 23.4h → fora
      ["2026-10-06 09:30", 0], // 23.5h exato → fora (janela usa > estrito)
      ["2026-10-06 09:36", 1], // 23.6h → dentro (24h)
      ["2026-10-06 10:30", 1], // 24.5h exato → dentro (<=)
      ["2026-10-06 10:36", 0], // 24.6h → fora
      ["2026-10-05 11:24", 0], // 1.4h → fora
      ["2026-10-05 11:30", 0], // 1.5h exato → fora (> estrito)
      ["2026-10-05 11:36", 1], // 1.6h → dentro (2h)
      ["2026-10-05 12:30", 1], // 2.5h exato → dentro (<=)
      ["2026-10-05 12:36", 0], // 2.6h → fora
    ] as const) {
      fakeSupabase.reset();
      fakeSupabase.setResolver(baseResolver([appointmentRow({ starts_at: startsAt })]));
      expect(await runReminderCheck(NOW), `starts_at=${startsAt}`).toBe(expected);
    }
  });

  it("upsert vazio = ja registrado por outra execucao → nao envia (idempotencia)", async () => {
    fakeSupabase.setResolver((q) => {
      if (q.table === "appointments") return { data: [appointmentRow()], error: null };
      if (q.table === "reminders") return { data: [], error: null };
      return undefined;
    });

    const sent = await runReminderCheck(NOW);

    expect(sent).toBe(0);
    expect(fakeSupabase.find("outbox", "insert")).toHaveLength(0);
    expect(outbox.processOutboxInBackground).toHaveBeenCalledTimes(1);
  });

  it("erro no upsert e reportado e o lembrete nao conta como enviado", async () => {
    fakeSupabase.setResolver((q) => {
      if (q.table === "appointments") return { data: [appointmentRow()], error: null };
      if (q.table === "reminders") return { error: { message: "42501" } };
      return undefined;
    });

    expect(await runReminderCheck(NOW)).toBe(0);
    expect(console.error).toHaveBeenCalledWith(
      "[reminders] Falha ao registrar o lembrete:",
      "42501"
    );
  });

  it("fila indisponível: desfaz o registro (delete) para a proxima execucao tentar", async () => {
    fakeSupabase.setResolver((q) => {
      if (q.table === "appointments") return { data: [appointmentRow()], error: null };
      if (q.table === "reminders" && q.op === "upsert") return { data: [{ id: 11 }], error: null };
      if (q.table === "reminders" && q.op === "delete") return { data: null, error: null };
      if (q.table === "conversations" && q.op === "select") return { data: null, error: null };
      if (q.table === "conversations" && q.op === "insert")
        return { data: { id: 77 }, error: null };
      if (q.table === "outbox" && q.op === "insert") return { error: { message: "42501" } };
      return undefined;
    });

    expect(await runReminderCheck(NOW)).toBe(0);
    expect(fakeSupabase.find("reminders", "delete")).toHaveLength(1);
    expect(console.error).toHaveBeenCalledWith(
      "[reminders] Lembrete devolvido (fila indisponivel); sera re-tentado."
    );
  });

  it("falha ao carregar as consultas vira lista vazia (sem lembrete, sem excecao)", async () => {
    fakeSupabase.setResolver((q) => {
      if (q.table === "appointments") return { error: { message: "timeout" } };
      return undefined;
    });

    expect(await runReminderCheck(NOW)).toBe(0);
    expect(console.error).toHaveBeenCalledWith(
      "[reminders] Falha ao carregar consultas:",
      "timeout"
    );
  });

  it("conversa ja existente: nao cria outra e grava direto nela", async () => {
    fakeSupabase.setResolver(
      baseResolver([appointmentRow({ conversation_id: 42, starts_at: "2026-10-06 10:00" })])
    );

    const sent = await runReminderCheck(NOW);

    expect(sent).toBe(1);
    expect(fakeSupabase.find("conversations", "select")).toHaveLength(0);
    expect(fakeSupabase.find("conversations", "insert")).toHaveLength(0);
    const enqueue = fakeSupabase.last("outbox", "insert");
    expect(enqueue?.payload).toMatchObject({ conversation_id: 42 });
  });

  it("profissional com telefone: notifica o profissional; sem telefone: pula", async () => {
    fakeSupabase.setResolver((q) => {
      if (q.table === "professionals") return { data: { phone: "+258 84 999 0000" } };
      return baseResolver([appointmentRow({ professional_id: "prof-1" })])(q);
    });
    expect(await runReminderCheck(NOW)).toBe(1);
    expect(notify.notifyDoctorReminder).toHaveBeenCalledTimes(1);
    expect(notify.notifyDoctorReminder).toHaveBeenCalledWith(
      "prof-1",
      "Dr. Simao",
      "+258 84 999 0000",
      "Maria Silva",
      "Cardiologia",
      "2026-10-06 10:00",
      1,
      4
    );

    notify.notifyDoctorReminder.mockClear();
    fakeSupabase.reset();
    fakeSupabase.setResolver(baseResolver([appointmentRow({ professional_id: null })]));
    expect(await runReminderCheck(NOW)).toBe(1);
    expect(notify.notifyDoctorReminder).not.toHaveBeenCalled();
    expect(fakeSupabase.find("professionals")).toHaveLength(0);
  });

  it("historico que falha nao impede o envio (best-effort)", async () => {
    fakeSupabase.setResolver((q) => {
      if (q.table === "messages") return { error: { message: "cheio" } };
      return baseResolver([appointmentRow()])(q);
    });

    expect(await runReminderCheck(NOW)).toBe(1);
    expect(console.error).toHaveBeenCalledWith(
      "[reminders] Falha ao gravar o lembrete no historico:",
      expect.any(Error)
    );
  });
});
