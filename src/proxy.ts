import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE = "saudesync_session";
const SESSION_SECRET =
  process.env.SESSION_SECRET || "saudesync-dev-secret-change-in-production";

// Validação leve da sessão (HMAC + expiração), sem consultar o banco.
// A checagem completa com banco continua sendo feita no layout de (app).
function isValidSession(token: string | undefined | null): boolean {
  if (!token) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  const expected = createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
  const sigBuf = Buffer.from(sig, "base64url");
  const expBuf = Buffer.from(expected, "base64url");
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { exp: number };
    return data.exp > Date.now();
  } catch {
    return false;
  }
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const authed = isValidSession(token);

  // Raiz: usuário autenticado vai direto para o painel.
  if (pathname === "/") {
    if (authed) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    // Durante o desenvolvimento, pula a landing e vai direto ao login.
    if (process.env.NODE_ENV !== "production") {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    // Em produção, envia visitantes para a landing page isolada em /landing.
    return NextResponse.redirect(new URL("/landing", request.url));
  }

  // Login: quem já está autenticado é enviado para o painel.
  if (pathname === "/login" && authed) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Exclui assets estáticos, API, imagens e arquivos de metadados.
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
