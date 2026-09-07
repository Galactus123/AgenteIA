import { describe, it, expect } from "vitest";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// ── Testes de verificacao de assinatura de webhook ─────────────────────

describe("Webhook — HMAC-SHA256 Signature Verification", () => {
  const SECRET = "whsec-test-" + randomBytes(8).toString("hex");

  function computeSignature(body: string): string {
    return createHmac("sha256", SECRET).update(body).digest("hex");
  }

  function verify(rawBody: string, signature: string | null | undefined): boolean {
    if (!SECRET) return true;
    if (!signature) return false;
    const expected = computeSignature(rawBody);
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }

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
});

describe("Webhook — Payload Size Validation", () => {
  const MAX_SIZE = 100_000; // 100KB

  function isValidPayloadSize(body: string): boolean {
    return Buffer.byteLength(body, "utf-8") <= MAX_SIZE;
  }

  it("deve aceitar payload pequeno", () => {
    expect(isValidPayloadSize('{"event":"test"}')).toBe(true);
  });

  it("deve aceitar payload de 100KB exato", () => {
    const body = "x".repeat(MAX_SIZE);
    expect(isValidPayloadSize(body)).toBe(true);
  });

  it("deve rejeitar payload de 100KB + 1", () => {
    const body = "x".repeat(MAX_SIZE + 1);
    expect(isValidPayloadSize(body)).toBe(false);
  });

  it("deve aceitar payload vazio", () => {
    expect(isValidPayloadSize("")).toBe(true);
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
