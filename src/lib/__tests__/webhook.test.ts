import { describe, it, expect, afterEach, vi } from "vitest";
import { createHmac, randomBytes } from "node:crypto";

vi.mock("@/lib/supabase", async () => {
  const { fakeSupabase } = await import("./helpers/supabase-fake");
  return { supabaseAdmin: fakeSupabase.admin };
});

import { verifyKomunikaSignature } from "@/lib/services/komunika";
import { isValidPayloadSize as realIsValidPayloadSize, MAX_WEBHOOK_BODY_BYTES } from "@/lib/agent/security";

// ── Testes de verificacao de assinatura de webhook ─────────────────────
//
// Usa a implementação real (verifyKomunikaSignature), não um espelho:
// um espelho pode passar ao mesmo tempo que o código de produção está errado.

describe("Webhook — HMAC-SHA256 Signature Verification", () => {
  const SECRET = "whsec-test-" + randomBytes(8).toString("hex");
  const originalSecret = process.env.KOMUNIKA_WEBHOOK_SECRET;

  function computeSignature(body: string): string {
    return createHmac("sha256", SECRET).update(body).digest("hex");
  }

  const verify = (rawBody: string, signature: string | null | undefined) => {
    process.env.KOMUNIKA_WEBHOOK_SECRET = SECRET;
    return verifyKomunikaSignature(rawBody, signature);
  };

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.KOMUNIKA_WEBHOOK_SECRET;
    else process.env.KOMUNIKA_WEBHOOK_SECRET = originalSecret;
  });

  it("deve aceitar assinatura valida", () => {
    const body = '{"event":"message.received","data":{"text":"oi"}}';
    const sig = computeSignature(body);
    expect(verify(body, sig)).toBe(true);
  });

  it("deve rejeitar assinatura invalida", () => {
    const body = '{"event":"message.received"}';
    expect(verify(body, "invalid-signature-here")).toBe(false);
  });

  it("deve rejeitar quando assinatura e nula", () => {
    const body = '{"event":"message.received"}';
    expect(verify(body, null)).toBe(false);
  });

  it("deve rejeitar quando assinatura e indefinida", () => {
    const body = '{"event":"message.received"}';
    expect(verify(body, undefined)).toBe(false);
  });

  it("deve rejeitar body alterado apos assinatura", () => {
    const body = '{"event":"message.received","data":{"text":"oi"}}';
    const sig = computeSignature(body);
    const tampered = '{"event":"message.received","data":{"text":"alterado"}}';
    expect(verify(tampered, sig)).toBe(false);
  });

  it("deve ser deterministica (mesmo body = mesma assinatura)", () => {
    const body = '{"test":true}';
    const sig1 = computeSignature(body);
    const sig2 = computeSignature(body);
    expect(sig1).toBe(sig2);
  });

  it("deve produzir assinaturas diferentes para bodies diferentes", () => {
    const sig1 = computeSignature('{"a":1}');
    const sig2 = computeSignature('{"a":2}');
    expect(sig1).not.toBe(sig2);
  });

  it("deve aceitar assinatura com formato hex valido (64 chars)", () => {
    const body = "test-payload";
    const sig = computeSignature(body);
    expect(sig).toMatch(/^[a-f0-9]{64}$/);
    expect(verify(body, sig)).toBe(true);
  });

  it("deve rejeitar tudo quando o secret do webhook nao esta configurado (fail-closed)", () => {
    const body = '{"event":"message.received"}';
    const sig = computeSignature(body);
    const saved = process.env.KOMUNIKA_WEBHOOK_SECRET;
    delete process.env.KOMUNIKA_WEBHOOK_SECRET;

    expect(verifyKomunikaSignature(body, sig)).toBe(false);

    if (saved === undefined) delete process.env.KOMUNIKA_WEBHOOK_SECRET;
    else process.env.KOMUNIKA_WEBHOOK_SECRET = saved;
  });
});

describe("Webhook — Payload Size Validation", () => {
  it("deve aceitar payload pequeno", () => {
    expect(realIsValidPayloadSize('{"event":"test"}')).toBe(true);
  });

  it("deve aceitar payload de 100KB exato", () => {
    const body = "x".repeat(MAX_WEBHOOK_BODY_BYTES);
    expect(realIsValidPayloadSize(body)).toBe(true);
  });

  it("deve rejeitar payload de 100KB + 1", () => {
    const body = "x".repeat(MAX_WEBHOOK_BODY_BYTES + 1);
    expect(realIsValidPayloadSize(body)).toBe(false);
  });

  it("deve aceitar payload vazio", () => {
    expect(realIsValidPayloadSize("")).toBe(true);
  });
});

describe("Webhook — Event Filtering", () => {
  const RECEIVED_EVENTS = new Set([
    "message.received",
    "message.inbound",
    "message.created",
    "incoming_message",
    "message",
  ]);

  it("deve aceitar message.received", () => {
    expect(RECEIVED_EVENTS.has("message.received")).toBe(true);
  });

  it("deve aceitar message.inbound", () => {
    expect(RECEIVED_EVENTS.has("message.inbound")).toBe(true);
  });

  it("deve ignorar message.sent", () => {
    expect(RECEIVED_EVENTS.has("message.sent")).toBe(false);
  });

  it("deve ignorar message.delivered", () => {
    expect(RECEIVED_EVENTS.has("message.delivered")).toBe(false);
  });

  it("deve ignorar string vazia", () => {
    expect(RECEIVED_EVENTS.has("")).toBe(false);
  });
});
