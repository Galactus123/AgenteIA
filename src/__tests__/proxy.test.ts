import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { PROTECTED_ROUTES, isProtectedRoute, config, proxy } from "../proxy";
import { resetRateLimits } from "@/lib/rate-limit";

describe("proxy — rotas protegidas", () => {
  it("reconhece cada página autenticada, inclusive subrotas", () => {
    for (const route of PROTECTED_ROUTES) {
      expect(isProtectedRoute(route), route).toBe(true);
      expect(isProtectedRoute(`${route}/qualquer/caminho`), route).toBe(true);
    }
    expect(isProtectedRoute("/configuracoes/assinatura")).toBe(true);
  });

  it("nao marca rotas publicas nem prefixos parecidos", () => {
    const publicRoutes = [
      "/",
      "/login",
      "/landing",
      "/precos",
      "/sobre-nos",
      "/termos",
      "/privacidade",
      "/agendamento-clinica-geral",
    ];
    for (const route of publicRoutes) {
      expect(isProtectedRoute(route), route).toBe(false);
    }
    expect(isProtectedRoute("/chatting")).toBe(false);
    expect(isProtectedRoute("/medicosa")).toBe(false);
    expect(isProtectedRoute("/api/auth/me")).toBe(false);
  });
});

describe("proxy — matcher", () => {
  const matcher = config.matcher;

  it("cobre todas as paginas autenticadas", () => {
    for (const route of PROTECTED_ROUTES) {
      expect(matcher, route).toContain(`${route}/:path*`);
    }
  });

  it("cobre /api para persistir o refresh de sessao", () => {
    expect(matcher).toContain("/api/:path*");
  });

  it("nao tem entrada obsoleta nem expoe rotas publicas", () => {
    const prefixes = matcher.map((entry) => entry.split("/")[1]);
    for (const stale of ["settings", "appointments", "login", "agendamento-clinica-geral"]) {
      expect(prefixes, stale).not.toContain(stale);
    }
  });
});

describe("proxy — rate-limit global da API por IP (Fase 9.3)", () => {
  beforeEach(() => resetRateLimits());

  const api = () => new NextRequest("http://localhost/api/qualquer");

  it("limite de 300/min: as 300 primeiras passam, a 301ª devolve 429", async () => {
    let last: Response | undefined;
    for (let i = 0; i < 300; i++) {
      last = await proxy(api());
      expect(last.status, `chamada ${i + 1}`).toBe(200);
    }

    const blocked = await proxy(api());
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Retry-After")).toBeTruthy();
    expect(await blocked.json()).toHaveProperty("retryAfterSec");
  });

  it("preflight OPTIONS passa livre mesmo com a cota estourada", async () => {
    for (let i = 0; i < 300; i++) await proxy(api());
    expect((await proxy(api())).status).toBe(429);

    const preflight = new NextRequest("http://localhost/api/webhooks/komunika", {
      method: "OPTIONS",
    });
    expect((await proxy(preflight)).status).toBe(200);
  });

  it("paginas protegidas nao entram na cota de API", async () => {
    for (let i = 0; i < 300; i++) await proxy(api());

    // Sem cookie de sessão: redireciona para /login (fluxo normal), não 429.
    const page = new NextRequest("http://localhost/dashboard");
    const res = await proxy(page);
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
  });
});
