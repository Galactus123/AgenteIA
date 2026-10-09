import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Fila de saida (Fase 8.3): backoff, enqueue invalido e o ciclo de
// claim → entrega → sent/retry/failed, incluindo 4xx definitivo e teto
// de tentativas. A Komunika e mockada; o supabase usa o harness fake.
vi.mock("@/lib/supabase", async () => {
  const { fakeSupabase } = await import("./helpers/supabase-fake");
  return { supabaseAdmin: fakeSupabase.admin };
});

vi.mock("@/lib/services/komunika", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/services/komunika")>();
  return {
    ...actual,
    isKomunikaConfigured: vi.fn(),
    checkKomunikaNumber: vi.fn(),
    sendKomunikaMessage: vi.fn(),
    getKomunikaInstanceIdForClinic: vi.fn(),
  };
});

import { fakeSupabase, type FakeQuery, type FakeResult } from "./helpers/supabase-fake";
import {
  backoffMinutes,
  enqueueOutboxMessage,
  processOutbox,
  OUTBOX_MAX_ATTEMPTS,
} from "@/lib/services/outbox";
import {
  isKomunikaConfigured,
  checkKomunikaNumber,
  sendKomunikaMessage,
  getKomunikaInstanceIdForClinic,
} from "@/lib/services/komunika";

const cfg = vi.mocked(isKomunikaConfigured);
const chk = vi.mocked(checkKomunikaNumber);
const send = vi.mocked(sendKomunikaMessage);
const instanceFor = vi.mocked(getKomunikaInstanceIdForClinic);

const pending = { id: 1, phone: "841234567", text: "oi", attempts: 0 };

function outboxResolver(opts: {
  candidates?: Record<string, unknown>[];
  claimError?: { message: string };
  claimRows?: Record<string, unknown>[] | null;
  finalizeError?: { message: string };
  insertError?: { message: string };
}) {
  return (q: FakeQuery): FakeResult | void => {
    if (q.table !== "outbox") return;
    if (q.op === "insert") return { data: { id: 9 }, error: opts.insertError ?? null };
    if (q.op === "select") return { data: opts.candidates ?? [], error: null };
    if (q.op === "update") {
      const status = (q.payload as { status?: string }).status;
      if (status === "sending")
        return { data: opts.claimRows ?? [], error: opts.claimError ?? null };
      return { data: null, error: opts.finalizeError ?? null };
    }
    return undefined;
  };
}

describe("outbox (Fase 8.3)", () => {
  beforeEach(() => {
    fakeSupabase.reset();
    cfg.mockReset();
    chk.mockReset();
    send.mockReset();
    instanceFor.mockReset();
    cfg.mockReturnValue(true);
    chk.mockResolvedValue({ ok: true, exists: true });
    send.mockResolvedValue({ ok: true, status: 200 });
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => vi.restoreAllMocks());

  describe("backoffMinutes", () => {
    it("cobre a tabela 1, 5, 15, 60, 240 com teto na ultima", () => {
      expect([0, 1, 2, 3, 4, 5, 99].map((n) => backoffMinutes(n))).toEqual([
        1, 1, 5, 15, 60, 240, 240,
      ]);
    });
  });

  describe("enqueueOutboxMessage", () => {
    it("numero sem digitos e invalidado antes do insert", async () => {
      expect(await enqueueOutboxMessage({ phone: "abc", text: "oi", kind: "chat_reply" })).toBeNull();
      expect(fakeSupabase.find("outbox", "insert")).toHaveLength(0);
      expect(console.warn).toHaveBeenCalled();
    });

    it("texto vazio (ou so espacos/quebras de linha) e invalidado", async () => {
      expect(await enqueueOutboxMessage({ phone: "841", text: "   ", kind: "chat_reply" })).toBeNull();
      expect(await enqueueOutboxMessage({ phone: "841", text: "\n\t ", kind: "reminder" })).toBeNull();
      expect(fakeSupabase.find("outbox", "insert")).toHaveLength(0);
    });

    it("insert que falha devolve null (o chamador desfaz o registro de origem)", async () => {
      fakeSupabase.setResolver(outboxResolver({ insertError: { message: "42501" } }));
      expect(await enqueueOutboxMessage({ phone: "841", text: "oi", kind: "reminder" })).toBeNull();
      expect(console.error).toHaveBeenCalledWith(
        "[outbox] Falha ao enfileirar (kind=reminder):",
        "42501"
      );
    });

    it("gravando: normaliza telefone, limpa markdown e marca pending", async () => {
      fakeSupabase.setResolver(outboxResolver({}));
      const id = await enqueueOutboxMessage({
        phone: "+258 84 123 4567",
        text: " **Ola** `ai` ",
        kind: "chat_reply",
        conversationId: 12,
      });
      expect(id).toBe(9);
      const ins = fakeSupabase.last("outbox", "insert");
      expect(ins?.payload).toMatchObject({
        phone: "258841234567",
        text: "Ola ai",
        kind: "chat_reply",
        conversation_id: 12,
        status: "pending",
        attempts: 0,
      });
    });

    it("grava clinic_id explicito e usa null quando ausente (sem DEFAULT na tabela)", async () => {
      fakeSupabase.setResolver(outboxResolver({}));

      await enqueueOutboxMessage({ phone: "841", text: "oi", kind: "chat_reply" });
      expect(fakeSupabase.last("outbox", "insert")?.payload).toMatchObject({ clinic_id: null });

      await enqueueOutboxMessage({
        phone: "841",
        text: "oi",
        kind: "reminder",
        clinicId: 7,
      });
      expect(fakeSupabase.last("outbox", "insert")?.payload).toMatchObject({ clinic_id: 7 });
    });
  });

  describe("processOutbox", () => {
    it("sem pendentes devolve zeros e nao tenta reclamar", async () => {
      fakeSupabase.setResolver(outboxResolver({ candidates: [] }));
      expect(await processOutbox()).toEqual({ claimed: 0, sent: 0, retried: 0, failed: 0 });
      expect(fakeSupabase.find("outbox", "update")).toHaveLength(0);
    });

    it("erro na busca de pendentes devolve zeros e reporta", async () => {
      fakeSupabase.setResolver((q) =>
        q.table === "outbox" && q.op === "select"
          ? { error: { message: "timeout" } }
          : undefined
      );
      expect(await processOutbox()).toEqual({ claimed: 0, sent: 0, retried: 0, failed: 0 });
      expect(console.error).toHaveBeenCalledWith("[outbox] Falha ao buscar pendentes:", "timeout");
    });

    it("o claim condiciona pending (ou sending obsoleto de 15min)", async () => {
      fakeSupabase.setResolver(outboxResolver({ candidates: [pending] }));
      await processOutbox();
      const select = fakeSupabase.last("outbox", "select");
      expect(select?.filters.some((f) => f.includes("status.eq.pending"))).toBe(true);
      expect(select?.filters.some((f) => f.includes("sending"))).toBe(true);
      const claim = fakeSupabase
        .find("outbox", "update")
        .find((q) => (q.payload as { status?: string }).status === "sending");
      expect(claim?.payload).toMatchObject({ status: "sending" });
      expect(claim?.filters.join(" ")).toContain("id in [1]");
    });

    it("claim disputado (nenhuma linha) devolve zeros sem entregar", async () => {
      fakeSupabase.setResolver(outboxResolver({ candidates: [pending], claimRows: null }));
      expect(await processOutbox()).toEqual({ claimed: 0, sent: 0, retried: 0, failed: 0 });
      expect(send).not.toHaveBeenCalled();
    });

    it("erro no claim devolve zeros e reporta", async () => {
      fakeSupabase.setResolver(
        outboxResolver({ candidates: [pending], claimError: { message: "lock" } })
      );
      expect(await processOutbox()).toEqual({ claimed: 0, sent: 0, retried: 0, failed: 0 });
      expect(console.error).toHaveBeenCalledWith("[outbox] Falha ao reclamar pendentes:", "lock");
    });

    it("entrega ok marca sent e conta 1", async () => {
      fakeSupabase.setResolver(outboxResolver({ candidates: [pending], claimRows: [pending] }));
      expect(await processOutbox()).toEqual({ claimed: 1, sent: 1, retried: 0, failed: 0 });
      expect(send).toHaveBeenCalledWith("841234567", "oi", {
        type: "text",
        instanceId: expect.any(String),
      });
      expect(instanceFor).not.toHaveBeenCalled();
      const finalize = fakeSupabase
        .find("outbox", "update")
        .filter((q) => (q.payload as { status?: string }).status !== "sending");
      expect(finalize[0]?.payload).toMatchObject({ status: "sent", last_error: null });
    });

    it("entrega pela instancia da clinica da linha (clinic_id no claim)", async () => {
      instanceFor.mockResolvedValue({ instanceId: "inst-clinica-9", source: "clinica" });
      const row = { ...pending, clinic_id: 9 };
      fakeSupabase.setResolver(outboxResolver({ candidates: [row], claimRows: [row] }));

      expect(await processOutbox()).toMatchObject({ sent: 1 });

      expect(instanceFor).toHaveBeenCalledWith(9);
      expect(chk).toHaveBeenCalledWith("841234567", "inst-clinica-9");
      expect(send).toHaveBeenCalledWith("841234567", "oi", {
        type: "text",
        instanceId: "inst-clinica-9",
      });
      const claim = fakeSupabase
        .find("outbox", "update")
        .find((q) => (q.payload as { status?: string }).status === "sending");
      expect(claim?.columns).toContain("clinic_id");
    });

    it("linha sem clinic_id entrega pela global sem consultar a clinica", async () => {
      fakeSupabase.setResolver(outboxResolver({ candidates: [pending], claimRows: [pending] }));

      expect(await processOutbox()).toMatchObject({ sent: 1 });

      expect(instanceFor).not.toHaveBeenCalled();
      expect(chk).toHaveBeenCalledWith("841234567", expect.any(String));
      expect(send).toHaveBeenCalledWith("841234567", "oi", {
        type: "text",
        instanceId: expect.any(String),
      });
    });

    it("falha transitoria (5xx) reagenda com backoff e conta retried", async () => {
      send.mockResolvedValue({ ok: false, status: 500, error: "boom" });
      fakeSupabase.setResolver(outboxResolver({ candidates: [pending], claimRows: [pending] }));

      expect(await processOutbox()).toEqual({ claimed: 1, sent: 0, retried: 1, failed: 0 });

      const finalize = fakeSupabase
        .find("outbox", "update")
        .filter((q) => (q.payload as { status?: string }).status !== "sending")[0];
      expect(finalize?.payload).toMatchObject({ status: "pending", attempts: 1 });
      expect(String((finalize?.payload as { last_error: string }).last_error)).toContain("500");
      expect(finalize?.payload).toHaveProperty("next_attempt_at");
    });

    it("401 (4xx permanente) marca failed e nao reagenda", async () => {
      send.mockResolvedValue({ ok: false, status: 401, error: "credencial" });
      fakeSupabase.setResolver(outboxResolver({ candidates: [pending], claimRows: [pending] }));

      expect(await processOutbox()).toEqual({ claimed: 1, sent: 0, retried: 0, failed: 1 });

      const finalize = fakeSupabase
        .find("outbox", "update")
        .filter((q) => (q.payload as { status?: string }).status !== "sending")[0];
      expect(finalize?.payload).toMatchObject({ status: "failed", attempts: 1 });
    });

    it("numero sem WhatsApp vira failed definitivo sem chamar o envio", async () => {
      chk.mockResolvedValue({ ok: true, exists: false });
      fakeSupabase.setResolver(outboxResolver({ candidates: [pending], claimRows: [pending] }));

      expect(await processOutbox()).toMatchObject({ failed: 1 });
      expect(send).not.toHaveBeenCalled();
    });

    it("check que falha nao bloqueia: segue para o envio", async () => {
      chk.mockResolvedValue({ ok: false, error: "timeout" });
      fakeSupabase.setResolver(outboxResolver({ candidates: [pending], claimRows: [pending] }));

      expect(await processOutbox()).toMatchObject({ sent: 1 });
      expect(send).toHaveBeenCalledTimes(1);
    });

    it("Komunika nao configurada reagenda com backoff sem consultar numero", async () => {
      cfg.mockReturnValue(false);
      fakeSupabase.setResolver(outboxResolver({ candidates: [pending], claimRows: [pending] }));

      expect(await processOutbox()).toMatchObject({ claimed: 1, retried: 1, failed: 0 });
      expect(chk).not.toHaveBeenCalled();
      expect(send).not.toHaveBeenCalled();

      const finalize = fakeSupabase
        .find("outbox", "update")
        .filter((q) => (q.payload as { status?: string }).status !== "sending")[0];
      expect(finalize?.payload).toMatchObject({ status: "pending", attempts: 1 });
      expect(finalize?.payload).toHaveProperty("next_attempt_at");
    });

    it(`Komunika nao configurada no teto de ${OUTBOX_MAX_ATTEMPTS} tentativas vira failed`, async () => {
      cfg.mockReturnValue(false);
      const row = { ...pending, attempts: OUTBOX_MAX_ATTEMPTS - 1 };
      fakeSupabase.setResolver(outboxResolver({ candidates: [row], claimRows: [row] }));

      expect(await processOutbox()).toMatchObject({ claimed: 1, retried: 0, failed: 1 });

      const finalize = fakeSupabase
        .find("outbox", "update")
        .filter((q) => (q.payload as { status?: string }).status !== "sending")[0];
      expect(finalize?.payload).toMatchObject({
        status: "failed",
        attempts: OUTBOX_MAX_ATTEMPTS,
      });
    });

    it(`atinge o teto de ${OUTBOX_MAX_ATTEMPTS} tentativas e vira failed mesmo com 5xx`, async () => {
      send.mockResolvedValue({ ok: false, status: 503, error: "instavel" });
      const row = { ...pending, attempts: OUTBOX_MAX_ATTEMPTS - 1 };
      fakeSupabase.setResolver(outboxResolver({ candidates: [row], claimRows: [row] }));

      expect(await processOutbox()).toEqual({ claimed: 1, sent: 0, retried: 0, failed: 1 });

      const finalize = fakeSupabase
        .find("outbox", "update")
        .filter((q) => (q.payload as { status?: string }).status !== "sending")[0];
      expect(finalize?.payload).toMatchObject({
        status: "failed",
        attempts: OUTBOX_MAX_ATTEMPTS,
      });
    });
  });
});
