import { describe, it, expect } from "vitest";
import { PROTECTED_ROUTES, isProtectedRoute, config } from "../proxy";

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
      "/teste-gratis",
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
