import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const tasks = vi.hoisted(() => ({
  runReminderCheck: vi.fn(async () => undefined),
  runSubscriptionCycleCheck: vi.fn(async () => undefined),
  processOutbox: vi.fn(async () => undefined),
  releaseNoShowAppointments: vi.fn(async () => undefined),
}));

vi.mock("@/lib/services/reminders", () => ({ runReminderCheck: tasks.runReminderCheck }));
vi.mock("@/lib/services/subscriptions", () => ({ runSubscriptionCycleCheck: tasks.runSubscriptionCycleCheck }));
vi.mock("@/lib/services/outbox", () => ({ processOutbox: tasks.processOutbox }));
vi.mock("@/lib/services/appointments", () => ({ releaseNoShowAppointments: tasks.releaseNoShowAppointments }));

type SchedulerModule = typeof import("@/lib/services/reminder-scheduler");

function resetGlobals(): void {
  delete (globalThis as { saudesyncScheduler?: unknown }).saudesyncScheduler;
}

function loadScheduler(vars: { VERCEL?: string; NODE_ENV?: string }): Promise<SchedulerModule> {
  vi.resetModules();
  resetGlobals();
  vi.stubEnv("NODE_ENV", vars.NODE_ENV ?? "test");
  vi.stubEnv("VERCEL", vars.VERCEL ?? "");
  return import("@/lib/services/reminder-scheduler");
}

describe("scheduler de lembretes (Fase 5.3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    resetGlobals();
  });

  it("em dev: roda um tick imediato com as 4 tarefas e agenda o intervalo de 60s", async () => {
    const setIntervalSpy = vi.spyOn(global, "setInterval").mockReturnValue({} as never);
    const mod = await loadScheduler({ NODE_ENV: "test" });

    mod.startReminderScheduler();

    expect(tasks.runReminderCheck).toHaveBeenCalledTimes(1);
    expect(tasks.runSubscriptionCycleCheck).toHaveBeenCalledTimes(1);
    expect(tasks.processOutbox).toHaveBeenCalledTimes(1);
    expect(tasks.releaseNoShowAppointments).toHaveBeenCalledTimes(1);
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 60_000);
  });

  it("em dev: segunda chamada não duplica o intervalo", async () => {
    const setIntervalSpy = vi.spyOn(global, "setInterval").mockReturnValue({} as never);
    const mod = await loadScheduler({ NODE_ENV: "test" });

    mod.startReminderScheduler();
    mod.startReminderScheduler();

    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
  });

  it("em produção (Vercel): não agenda nada e deixa o pg_cron no comando", async () => {
    const setIntervalSpy = vi.spyOn(global, "setInterval").mockReturnValue({} as never);
    const mod = await loadScheduler({ VERCEL: "1" });

    mod.startReminderScheduler();

    expect(setIntervalSpy).not.toHaveBeenCalled();
    expect(tasks.runReminderCheck).not.toHaveBeenCalled();
    expect(tasks.processOutbox).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("pg_cron"));
  });

  it("tarefa que falha é reportada sem derrubar o tick", async () => {
    vi.spyOn(global, "setInterval").mockReturnValue({} as never);
    tasks.runReminderCheck.mockRejectedValueOnce(new Error("banco fora"));
    const mod = await loadScheduler({ NODE_ENV: "test" });

    mod.startReminderScheduler();

    await vi.waitFor(() => {
      expect(console.error).toHaveBeenCalledWith(
        "[scheduler] Falha em runReminderCheck:",
        expect.any(Error)
      );
    });
    expect(tasks.processOutbox).toHaveBeenCalledTimes(1);
  });
});
