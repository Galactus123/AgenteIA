import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

vi.hoisted(() => {
  // URL sem porta: o prefixo do cookie deriva do project ref (parte antes
  // do primeiro ponto), igual ao Supabase real (sb-demo-auth-token).
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://demo.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key-de-teste";
});

// Sessão devolvida pelo createServerClient mockado. O proxy só consulta
// getSession() quando o cookie sb- já existe, então o mock controla o
// resultado sem rede: null = sem sessão, objeto = sessão válida.
const auth = vi.hoisted(() => ({
  getSession: vi.fn<() => Promise<{ data: { session: unknown } }>>(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getSession: auth.getSession,
      getUser: vi.fn(),
    },
  }),
}));

import {
  PROTECTED_ROUTES,
  SESSION_PUBLIC_ROUTES,
  isProtectedRoute,
  config,
  proxy,
} from "../proxy";
import { resetRateLimits } from "@/lib/rate-limit";

const SESSION_COOKIE = "sb-demo-auth-token";

const validSession = {
  access_token: "token-de-teste",
  refresh_token: "refresh-de-teste",
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: { id: "user-1", email: "clinica@example.com" },
};

function request(path: string, options?: { withCookie?: boolean }) {
  return new NextRequest(`http://localhost${path}`, {
    headers: options?.withCookie ? { cookie: `${SESSION_COOKIE}=%7B%22access_token%22%3A%22x%22%7D` } : {},
  });
}

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

describe("proxy — sessão do utilizador", () => {
  beforeEach(() => {
    resetRateLimits();
    vi.clearAllMocks();
    auth.getSession.mockResolvedValue({ data: { session: null } });
  });

  it("visitante sem cookie vê a landing e o login sem redirecionamento", async () => {
    expect((await proxy(request("/"))).status).toBe(200);
    expect((await proxy(request("/login"))).status).toBe(200);
  });

  it("visitante sem cookie numa página protegida vai para /login", async () => {
    const res = await proxy(request("/pacientes"));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
  });

  it("cookie presente mas sessao expirada volta para /login", async () => {
    auth.getSession.mockResolvedValue({ data: { session: null } });
    const res = await proxy(request("/consultas", { withCookie: true }));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
  });

  it("sessao valida passa pela pagina protegida", async () => {
    auth.getSession.mockResolvedValue({ data: { session: validSession } });
    const res = await proxy(request("/dashboard", { withCookie: true }));
    expect(res.status).toBe(200);
  });

  it("/login com sessao valida redireciona para /dashboard", async () => {
    auth.getSession.mockResolvedValue({ data: { session: validSession } });
    const res = await proxy(request("/login", { withCookie: true }));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/dashboard");
  });

  it("/login com cookie invalido continua a mostrar o login", async () => {
    auth.getSession.mockResolvedValue({ data: { session: null } });
    const res = await proxy(request("/login", { withCookie: true }));
    expect(res.status).toBe(200);
  });

  it("landing com sessao valida continua servida (sem salto forcado)", async () => {
    auth.getSession.mockResolvedValue({ data: { session: validSession } });
    const res = await proxy(request("/", { withCookie: true }));
    expect(res.status).toBe(200);
  });

  it("indisponibilidade do Supabase nao redireciona: a pagina decide", async () => {
    auth.getSession.mockRejectedValue(new Error("rede em baixo"));
    const res = await proxy(request("/pacientes", { withCookie: true }));
    expect(res.status).toBe(200);
  });
});

describe("proxy — matcher", () => {
  const matcher = config.matcher;

  it("cobre todas as paginas autenticadas", () => {
    for (const route of PROTECTED_ROUTES) {
      expect(matcher, route).toContain(`${route}/:path*`);
    }
  });

  it("cobre a landing e o login para a deteccao de sessao", () => {
    for (const route of SESSION_PUBLIC_ROUTES) {
      expect(matcher, route).toContain(route);
    }
  });

  it("cobre /api para persistir o refresh de sessao", () => {
    expect(matcher).toContain("/api/:path*");
  });

  it("nao entra em estaticos, imagens ou assets publicos", () => {
    // Matcher é lista branca de prefixos: nada de _next/static, _next/image,
    // favicon.ico ou ficheiros de public/ chega ao proxy.
    const prefixes = matcher.map((entry) => entry.split("/")[1]);
    for (const excluded of ["_next", "favicon.ico"]) {
      expect(prefixes, excluded).not.toContain(excluded);
    }
    expect(matcher.every((entry) => !entry.includes("\\."))).toBe(true);
  });

  it("nao tem entrada obsoleta nem expoe rotas publicas de marketing", () => {
    const prefixes = matcher.map((entry) => entry.split("/")[1]);
    for (const stale of ["settings", "appointments", "agendamento-clinica-geral", "precos", "sobre-nos"]) {
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
