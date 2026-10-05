import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { clientIp, rateLimit, resetRateLimits, tooManyRequests } from "@/lib/rate-limit";

beforeEach(() => {
  resetRateLimits();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("rateLimit", () => {
  it("aceita ate o limite dentro da janela", () => {
    for (let i = 0; i < 3; i++) {
      expect(rateLimit("k", 3, 60_000).ok).toBe(true);
    }
  });

  it("bloqueia na tentativa acima do limite com Retry-After", () => {
    rateLimit("k", 2, 60_000);
    rateLimit("k", 2, 60_000);
    const blocked = rateLimit("k", 2, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
    expect(blocked.retryAfterSec).toBeLessThanOrEqual(60);
  });

  it("janela expirada libera novas tentativas", () => {
    rateLimit("k", 1, 60_000);
    expect(rateLimit("k", 1, 60_000).ok).toBe(false);

    vi.advanceTimersByTime(61_000);
    expect(rateLimit("k", 1, 60_000).ok).toBe(true);
  });

  it("chaves sao independentes", () => {
    rateLimit("a", 1, 60_000);
    expect(rateLimit("a", 1, 60_000).ok).toBe(false);
    expect(rateLimit("b", 1, 60_000).ok).toBe(true);
  });

  it("expira buckets antigos no sweep", () => {
    rateLimit("stale", 5, 60_000);
    vi.advanceTimersByTime(120_000);
    // nova chamada em outra chave dispara o sweep sem derrubar a logica
    expect(rateLimit("stale", 5, 60_000).ok).toBe(true);
  });
});

describe("clientIp", () => {
  it("usa o primeiro IP do x-forwarded-for", () => {
    const req = new NextRequest("http://localhost/api", {
      headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1" },
    });
    expect(clientIp(req)).toBe("203.0.113.7");
  });

  it("cai para 'local' sem headers", () => {
    const req = new NextRequest("http://localhost/api");
    expect(clientIp(req)).toBe("local");
  });
});

describe("tooManyRequests", () => {
  it("devolve 429 com Retry-After", () => {
    const res = tooManyRequests(30);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("30");
  });
});
