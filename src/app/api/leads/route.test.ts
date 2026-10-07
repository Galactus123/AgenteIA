import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { fakeSupabase } from "@/lib/__tests__/helpers/supabase-fake";

vi.mock("@/lib/supabase", async () => {
  const { fakeSupabase } = await import("@/lib/__tests__/helpers/supabase-fake");
  return { supabaseAdmin: fakeSupabase.admin };
});

import { POST } from "./route";
import { resetRateLimits } from "@/lib/rate-limit";

// ── POST /api/leads — formulário público de teste grátis ────────────────────
//
// Público de propósito (sem requireAuth): quem preenche ainda não tem
// conta. Cobre: gravação, validação server-side, corpo inválido, erro de
// banco sem vazar a causa e o teto de 5/h por IP.

const VALID_BODY = {
  clinicName: "Clínica Central",
  contactName: "Ana Silva",
  whatsapp: "+258 84 123 4567",
  country: "br",
  specialty: "Pediatria",
  email: "ana@example.com",
  plan: "pro",
  source: "teste-gratis",
  utmSource: "precos",
};

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/leads", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/leads", () => {
  beforeEach(() => {
    fakeSupabase.reset();
    resetRateLimits();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("grava o lead com 201 e devolve ok", async () => {
    fakeSupabase.setResolver(() => ({ data: null, error: null }));

    const res = await POST(makeRequest(VALID_BODY));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.ok).toBe(true);

    const insert = fakeSupabase.last("trial_leads", "insert");
    expect(insert?.payload).toMatchObject({
      clinic_name: "Clínica Central",
      contact_name: "Ana Silva",
      whatsapp: "258841234567",
      country: "br",
      email: "ana@example.com",
      plan: "pro",
      source: "teste-gratis",
      utm_source: "precos",
    });
  });

  it("lead sem WhatsApp válido: 400 e nada gravado", async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, whatsapp: "123" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("WhatsApp");
    expect(fakeSupabase.find("trial_leads", "insert")).toHaveLength(0);
  });

  it("JSON inválido: 400 sem executar o handler de negócio", async () => {
    const res = await POST(makeRequest("{isso nao e json"));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBeTruthy();
    expect(fakeSupabase.find("trial_leads")).toHaveLength(0);
  });

  it("erro de banco: 500 com mensagem genérica (não vaza a causa)", async () => {
    fakeSupabase.setResolver(() => ({
      data: null,
      error: { message: "permission denied for table trial_leads" },
    }));

    const res = await POST(makeRequest(VALID_BODY));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toContain("Não foi possível");
    expect(JSON.stringify(body)).not.toContain("permission denied");
  });

  it("e-mail duplicado responde 201 (retry do próprio utilizador)", async () => {
    fakeSupabase.setResolver(() => ({
      data: null,
      error: { message: "duplicate key value violates unique constraint", code: "23505" },
    }));

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(201);
    expect((await res.json()).duplicate).toBe(true);
  });

  it("rate-limit: aceita 5 pedidos por hora e o 6º devolve 429", async () => {
    fakeSupabase.setResolver(() => ({ data: null, error: null }));

    for (let i = 1; i <= 5; i++) {
      const res = await POST(makeRequest(VALID_BODY));
      expect(res.status, `pedido ${i}`).toBe(201);
    }

    const blocked = await POST(makeRequest(VALID_BODY));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Retry-After")).toBeTruthy();
    expect(fakeSupabase.find("trial_leads", "insert")).toHaveLength(5);
  });
});
