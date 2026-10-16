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

// Páginas públicas que o proxy consulta com a sessão ativa:
// - `/login`: sessão válida redireciona para /dashboard (utilizador já entrou).
// - `/`: sessão válida é só registada (cookies renovados no servidor); a
//   landing continua a ser servida normalmente e a Navbar mostra o estado.
export const SESSION_PUBLIC_ROUTES = ["/", "/login"] as const;

export function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

function needsSessionCheck(pathname: string): boolean {
  return (
    isProtectedRoute(pathname) ||
    (SESSION_PUBLIC_ROUTES as readonly string[]).includes(pathname)
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
  const pathname = request.nextUrl.pathname;
  // Encaminha o caminho pedido para os Server Components: o layout do app
  // precisa de saber a página atual para redirecionar clínicas sem
  // subscrição ativa só quando a página não é a de faturação.
  request.headers.set("x-pathname", pathname);

  let supabaseResponse = NextResponse.next({ request });

  // ── Rate-limit global por IP na API inteira (9.3) ──────────────────────
  // Teto geral que cobre qualquer rota nova sem limite próprio. Os limites
  // finos por rota (login 30/5min por IP, signup 10/h, webhooks 60/min...)
  // seguem valendo por cima. Preflight de CORS fica de fora.
  if (pathname.startsWith("/api/") && request.method !== "OPTIONS") {
    const global = rateLimit(`proxy:api:${clientIp(request)}`, 300, 60_000);
    if (!global.ok) return tooManyRequests(global.retryAfterSec);
  }

  const isProtected = isProtectedRoute(pathname);
  const isApi = pathname.startsWith("/api/");

  if (!needsSessionCheck(pathname) && !isApi) {
    return supabaseResponse;
  }

  if (!hasSessionCookie(request)) {
    // Só página vai para /login: rota de API devolve 401 do próprio handler.
    if (isProtected) {
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
  // `null` = indeterminado (Supabase indisponível): nunca redireciona, a
  // página decide via getUser() como já fazia.
  let sessionValid: boolean | null = null;
  try {
    const { data } = await supabase.auth.getSession();
    sessionValid = Boolean(data.session);
  } catch {
    sessionValid = null;
  }

  if (isApi) {
    return supabaseResponse;
  }

  if (isProtected) {
    // Cookie presente mas sessão expirada/revogada de facto: volta ao login
    // em vez de deixar a página renderizar e falhar logo a seguir.
    if (sessionValid === false) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return supabaseResponse;
  }

  if (pathname === "/login") {
    // Já tem sessão ativa: não faz sentido mostrar o formulário de novo.
    if (sessionValid === true) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return supabaseResponse;
  }

  // pathname === "/": landing servida normalmente (sem salto forçado). A
  // Navbar detecta o cookie sb- e confirma a sessão em /api/auth/me para
  // mostrar "Ir para o Dashboard" — assim a landing continua estática para
  // visitantes anónimos e o proxy só renova o cookie no servidor.
  return supabaseResponse;
}

export const config = {
  matcher: [
    "/",
    "/login",
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
