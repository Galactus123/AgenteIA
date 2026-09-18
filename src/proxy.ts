import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

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

  // Atualizar sessão (refresh de token se expirado)
  // Nota: getUser() é síncrono no proxy, mas o Supabase SSR lida com isso internamente
  // Para simplificar, verificamos se o cookie de sessão existe
  const sessionCookie = request.cookies.get("sb-" + process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https?:\/\/([^.]+)/)?.[1] + "-auth-token")?.value;

  // Rotas protegidas
  const pathname = request.nextUrl.pathname;
  const isProtectedRoute =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/consultas") ||
    pathname.startsWith("/pacientes") ||
    pathname.startsWith("/medicos") ||
    pathname.startsWith("/especialidades") ||
    pathname.startsWith("/perfil") ||
    pathname.startsWith("/clinica") ||
    pathname.startsWith("/chat") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/appointments");

  if (isProtectedRoute && !sessionCookie) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/perfil/:path*",
    "/medicos/:path*",
    "/especialidades/:path*",
    "/consultas/:path*",
    "/clinica/:path*",
    "/chat/:path*",
    "/settings/:path*",
    "/appointments/:path*",
    "/pacientes/:path*",
  ],
};
