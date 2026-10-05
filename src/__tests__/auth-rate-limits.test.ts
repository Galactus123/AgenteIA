import { describe, it, expect, vi, beforeEach } from "vitest";

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key-de-teste";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key-de-teste";
});

// O rate limit é o primeiro passo das duas rotas; o resto do handler é
// alcançado só dentro da janela permitida (401 sem sessão).
vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: null } })) },
  })),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({})),
}));

import { NextRequest } from "next/server";
import { PUT as changePassword } from "@/app/api/auth/password/route";
import { PUT as changeEmail } from "@/app/api/auth/email/route";
import { resetRateLimits } from "@/lib/rate-limit";

function put(path: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PUT /api/auth/password e /api/auth/email — rate-limit por IP (Fase 9.3)", () => {
  beforeEach(() => {
    resetRateLimits();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("password: 15 tentativas seguem (401 sem sessão); a 16ª devolve 429", async () => {
    for (let i = 0; i < 15; i++) {
      const res = await changePassword(put("/api/auth/password", {}));
      expect(res.status, `tentativa ${i + 1}`).toBe(401);
    }

    const res = await changePassword(put("/api/auth/password", {}));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
    expect(await res.json()).toHaveProperty("retryAfterSec");
  });

  it("email: mesmo teto de 15 tentativas por IP", async () => {
    for (let i = 0; i < 15; i++) {
      const res = await changeEmail(put("/api/auth/email", {}));
      expect(res.status, `tentativa ${i + 1}`).toBe(401);
    }

    const res = await changeEmail(put("/api/auth/email", {}));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
  });

  it("limpa os buckets ao resetar (isolamento entre testes)", async () => {
    for (let i = 0; i < 15; i++) await changePassword(put("/api/auth/password", {}));
    expect((await changePassword(put("/api/auth/password", {}))).status).toBe(429);

    resetRateLimits();
    expect((await changePassword(put("/api/auth/password", {}))).status).toBe(401);
  });
});
