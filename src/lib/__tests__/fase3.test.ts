import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

// O supabase.js cria o client no import — precisa de env antes.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
});

import { backoffMinutes, OUTBOX_MAX_ATTEMPTS } from "@/lib/services/outbox";
import { SlotTakenError } from "@/lib/services/appointments";
import { HUMAN_TRANSFER_NOTICE, TRANSFER_WAITING_REPLY } from "@/lib/services/transfers";

// ── 3.4: backoff da fila outbox ──────────────────────────────

describe("Outbox — backoff de reenvio", () => {
  it("progride 1, 5, 15, 60, 240 minutos", () => {
    expect(backoffMinutes(1)).toBe(1);
    expect(backoffMinutes(2)).toBe(5);
    expect(backoffMinutes(3)).toBe(15);
    expect(backoffMinutes(4)).toBe(60);
    expect(backoffMinutes(5)).toBe(240);
  });

  it("fica no teto de 240 min apos esgotar a tabela", () => {
    expect(backoffMinutes(6)).toBe(240);
    expect(backoffMinutes(99)).toBe(240);
  });

  it("tentativa 0 (primeira) usa o menor intervalo", () => {
    expect(backoffMinutes(0)).toBe(1);
    expect(backoffMinutes(-1)).toBe(1);
  });

  it("MAX_ATTEMPTS coerente com a tabela de backoff", () => {
    expect(OUTBOX_MAX_ATTEMPTS).toBe(5);
    expect(backoffMinutes(OUTBOX_MAX_ATTEMPTS)).toBeGreaterThan(
      backoffMinutes(OUTBOX_MAX_ATTEMPTS - 1)
    );
  });
});

// ── 3.3: erro tipado de corrida de horario ───────────────────

describe("SlotTakenError — concorrencia de horario", () => {
  it("e um Error com codigo SLOT_TAKEN", () => {
    const err = new SlotTakenError();
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("SlotTakenError");
    expect(err.code).toBe("SLOT_TAKEN");
  });

  it("mensagem padrao e amigavel e em portugues", () => {
    const err = new SlotTakenError();
    expect(err.message).toContain("ocupado");
    expect(err.message).toContain("outro horário");
  });

  it("aceita mensagem customizada (remarcacao)", () => {
    const err = new SlotTakenError("Este horário já não está disponível. Escolha outro horário.");
    expect(err.message).toContain("já não está disponível");
    expect(err.code).toBe("SLOT_TAKEN");
  });

  it("detecta violacao unica do Postgres (23505) via instanceof", () => {
    // O servico converte error.code === "23505" em SlotTakenError;
    // consumidores (API/agente) checam apenas instanceof.
    function mapSupabaseError(code: string): Error {
      if (code === "23505") return new SlotTakenError();
      return new Error("outro erro");
    }
    expect(mapSupabaseError("23505")).toBeInstanceOf(SlotTakenError);
    expect(mapSupabaseError("23502")).not.toBeInstanceOf(SlotTakenError);
  });
});

// ── 3.1: crons do vercel.json precisam ser diarios (Hobby) ──

describe("vercel.json — limites de cron da Vercel Hobby", () => {
  interface VercelCron {
    path: string;
    schedule: string;
  }
  const config = JSON.parse(
    readFileSync(path.resolve(process.cwd(), "vercel.json"), "utf8")
  ) as { crons: VercelCron[] };

  it("tem os 3 endpoints internos", () => {
    const paths = config.crons.map((c) => c.path).sort();
    expect(paths).toEqual([
      "/api/outbox/run",
      "/api/reminders/run",
      "/api/subscription/cycle/run",
    ]);
  });

  it("todos os schedules sao diarios (Hobby falha no deploy se > 1x/dia)", () => {
    for (const cron of config.crons) {
      const [minute, hour, dom, month, dow] = cron.schedule.split(" ");
      expect(minute).toMatch(/^\d+$/);
      expect(hour).toMatch(/^\d+$/);
      expect(dom).toBe("*");
      expect(month).toBe("*");
      expect(dow).toBe("*");
    }
  });

  it("todo path comeca com /api/", () => {
    for (const cron of config.crons) {
      expect(cron.path.startsWith("/api/")).toBe(true);
    }
  });
});

// ── 3.5: mensagens de transferencia ─────────────────────────

describe("Transferencia — mensagens fixas", () => {
  it("aviso ao paciente e espera sao distintos e nao vazios", () => {
    expect(HUMAN_TRANSFER_NOTICE.length).toBeGreaterThan(20);
    expect(TRANSFER_WAITING_REPLY.length).toBeGreaterThan(20);
    expect(HUMAN_TRANSFER_NOTICE).not.toBe(TRANSFER_WAITING_REPLY);
  });
});
