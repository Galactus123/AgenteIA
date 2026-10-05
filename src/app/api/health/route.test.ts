import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// /api/health (Fase 8.2): 200 "ok" so quando o banco responde;
// erro ou timeout de 3s viram 503 "degraded" sem vazar detalhes.
vi.mock("@/lib/supabase", async () => {
  const { fakeSupabase } = await import("@/lib/__tests__/helpers/supabase-fake");
  return { supabaseAdmin: fakeSupabase.admin };
});

import { fakeSupabase } from "@/lib/__tests__/helpers/supabase-fake";
import { GET } from "./route";

describe("GET /api/health (Fase 8.2)", () => {
  beforeEach(() => fakeSupabase.reset());

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("banco respondendo: 200 {status:ok, checks.database:ok} e sem cache", async () => {
    fakeSupabase.setResolver(() => ({ data: { id: 1 }, error: null }));

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.checks).toEqual({ database: "ok" });
    expect(typeof body.timestamp).toBe("string");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("erro do banco: 503 {status:degraded, checks.database:fail} sem expor a causa", async () => {
    fakeSupabase.setResolver(() => ({ error: { message: "credential invalid" } }));

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.status).toBe("degraded");
    expect(body.checks).toEqual({ database: "fail" });
    expect(JSON.stringify(body)).not.toContain("credential");
  });

  it("banco que nunca responde: estoura o timeout de 3s e vira 503", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    fakeSupabase.setResolver(() => new Promise<never>(() => {}) as never);

    const pending = GET();
    await vi.advanceTimersByTimeAsync(3500);
    const res = await pending;
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.checks).toEqual({ database: "fail" });
  });

  it("rejeicao inesperada do cliente: 503 (nunca 500)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    fakeSupabase.setResolver(() => {
      throw new Error("boom");
    });

    const res = await GET();
    expect(res.status).toBe(503);
    expect((await res.json()).status).toBe("degraded");
  });
});
