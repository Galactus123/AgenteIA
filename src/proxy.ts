import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

// Páginas autenticadas: tudo que fica sob o grupo `(app)`.
// Precisa bater com `config.matcher` — `src/__tests__/proxy.test.ts` falha se
// um dos lados mudar sozinho.
export const PROTECTED_ROUTES = [
  "/chat",
  "/clinica",
  "/configuracoes",
  "/consultas",
  "/dashboard",
  "/especialidades",
  "/medicos",
  "/pacientes",
  "/perfil",
] as const;

export function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

function authCookiePrefix(): string | null {
  const projectRef =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https?:\/\/([^.]+)/)?.[1];
  return projectRef ? `sb-${projectRef}-auth-token` : null;
}

function hasSessionCookie(request: NextRequest): boolean {
  const prefix = authCookiePrefix();
  if (!prefix) return false;
  // Sessão grande pode ser dividida em chunks (sb-<ref>-auth-token.0, .1, ...).
  return request.cookies
    .getAll()
    .some(({ name }) => name === prefix || name.startsWith(`${prefix}.`));
}

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;

  // ── Rate-limit global por IP na API inteira (9.3) ──────────────────────
  // Teto geral que cobre qualquer rota nova sem limite próprio. Os limites
  // finos por rota (login 30/5min por IP, signup 10/h, webhooks 60/min...)
  // seguem valendo por cima. Preflight de CORS fica de fora.
  if (pathname.startsWith("/api/") && request.method !== "OPTIONS") {
    const global = rateLimit(`proxy:api:${clientIp(request)}`, 300, 60_000);
    if (!global.ok) return tooManyRequests(global.retryAfterSec);
  }

  if (!isProtectedRoute(pathname) && !pathname.startsWith("/api/")) {
    return supabaseResponse;
  }

  if (!hasSessionCookie(request)) {
    // Só página vai para /login: rota de API devolve 401 do próprio handler.
    if (isProtectedRoute(pathname)) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return supabaseResponse;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // A sessão expira em 1h e o refresh só pode ser gravado aqui: Server Component
  // não consegue escrever cookie e a maioria das rotas de API usa `setAll() {}`,
  // então sem este passo o token girado é descartado e toda requisição seguinte
  // refaz o refresh com o mesmo refresh token.
  try {
    await supabase.auth.getSession();
  } catch {
    // Supabase indisponível: segue sem refresh; a página faz getUser() e decide.
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/chat/:path*",
    "/perfil/:path*",
    "/medicos/:path*",
    "/especialidades/:path*",
    "/consultas/:path*",
    "/clinica/:path*",
    "/configuracoes/:path*",
    "/pacientes/:path*",
    "/dashboard/:path*",
    "/api/:path*",
  ],
};
