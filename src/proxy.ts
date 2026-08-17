import { NextRequest, NextResponse } from "next/server";
import { authCookie, readSessionToken } from "@/lib/auth";

// Próxima geração do middleware: Proxy (Node.js runtime por padrão).
// Protege as rotas do dashboard: redireciona para /login se o cookie de sessão
// não existir, estiver expirado, com assinatura inválida ou de admin removido.
export function proxy(request: NextRequest) {
  const token = request.cookies.get(authCookie)?.value;
  const session = readSessionToken(token);
  if (!session) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
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
  ],
};
