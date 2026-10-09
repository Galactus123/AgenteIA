import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ── Webhook inbound da Komunika — gate de assinatura ativa ──────────────────
//
// Acesso estrito pos-pagamento: sem linha "active" em subscriptions para a
// clinica dona da instancia (webhook da LOJOU) o agente NAO roda — mensagem
// ignorada antes de typing, LLM e enqueue. O protocolo HMAC e testado em
// webhook.test.ts; aqui testamos o fluxo processInboundMessage (exportado).

vi.mock("@/lib/supabase", async () => {
  const { fakeSupabase } = await import("@/lib/__tests__/helpers/supabase-fake");
  return { supabaseAdmin: fakeSupabase.admin };
});

vi.mock("@/lib/services/plan-limits", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/services/plan-limits")>();
  return { ...actual, guardActiveSubscription: vi.fn() };
});

vi.mock("@/lib/services/komunika", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/services/komunika")>();
  return {
    ...actual,
    getClinicIdByInstanceId: vi.fn(),
    sendKomunikaTyping: vi.fn(),
  };
});

vi.mock("@/lib/agent/agent", () => ({
  handlePatientMessage: vi.fn(),
}));

vi.mock("@/lib/services/outbox", () => ({
  enqueueOutboxMessage: vi.fn(),
  processOutboxInBackground: vi.fn(),
}));

import { guardActiveSubscription } from "@/lib/services/plan-limits";
import { BILLING_PATH } from "@/lib/subscription-access";
import { getClinicIdByInstanceId, sendKomunikaTyping } from "@/lib/services/komunika";
import { handlePatientMessage } from "@/lib/agent/agent";
import { enqueueOutboxMessage, processOutboxInBackground } from "@/lib/services/outbox";
import { processInboundMessage } from "@/app/api/webhooks/komunika/route";

const guard = vi.mocked(guardActiveSubscription);
const resolveClinic = vi.mocked(getClinicIdByInstanceId);
const typing = vi.mocked(sendKomunikaTyping);
const agent = vi.mocked(handlePatientMessage);
const enqueue = vi.mocked(enqueueOutboxMessage);
const background = vi.mocked(processOutboxInBackground);

const gateNone = {
  status: 402,
  body: {
    error: "Assinatura inativa.",
    code: "SUBSCRIPTION_REQUIRED",
    subscriptionStatus: "none",
    redirectTo: BILLING_PATH,
  },
} as const;

function inbound() {
  return { phone: "258841234567", text: "oi, tudo bem?", instanceId: "inst-clinica-9" };
}

describe("webhook Komunika — gate de assinatura ativa", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    guard.mockResolvedValue(null);
    resolveClinic.mockResolvedValue(7);
    typing.mockResolvedValue({ ok: true, status: 200 });
    agent.mockResolvedValue({
      reply: "Ola! Como posso ajudar?",
      transferred: false,
      conversationId: 5,
    });
    enqueue.mockResolvedValue(11);
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => vi.restoreAllMocks());

  it("sem assinatura ativa: ignora antes de typing, agente e enqueue", async () => {
    guard.mockResolvedValue(gateNone);

    await processInboundMessage(inbound());

    expect(guard).toHaveBeenCalledWith(7);
    expect(typing).not.toHaveBeenCalled();
    expect(agent).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
    expect(background).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("assinatura inativa"));
  });

  it("com assinatura ativa: fluxo completo com clinic_id resolvido", async () => {
    await processInboundMessage(inbound());

    expect(guard).toHaveBeenCalledWith(7);
    expect(typing).toHaveBeenCalledWith("258841234567", {
      type: "composing",
      instanceId: "inst-clinica-9",
    });
    expect(agent).toHaveBeenCalledWith("258841234567", "oi, tudo bem?", 7);
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ clinicId: 7, conversationId: 5 })
    );
    expect(background).toHaveBeenCalledTimes(1);
  });

  it("instancia sem dona (clinicId null) bloqueia — fail-closed", async () => {
    resolveClinic.mockResolvedValue(null);
    guard.mockResolvedValue(gateNone);

    await processInboundMessage(inbound());

    expect(guard).toHaveBeenCalledWith(null);
    expect(agent).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("clinicId null com gate ligado segue o kill switch (libera quando desativado)", async () => {
    resolveClinic.mockResolvedValue(null);
    guard.mockResolvedValue(null); // SUBSCRIPTION_GATE_DISABLED=1 devolve null

    await processInboundMessage(inbound());

    expect(agent).toHaveBeenCalledWith("258841234567", "oi, tudo bem?", null);
  });
});
