import { NextRequest, NextResponse } from "next/server";
import { authCookie, getAuthFromCookies, type SessionData } from "@/lib/auth";

export function requireAuth(request: NextRequest): NextResponse | null {
  const session = getAuthFromCookies(request.cookies.get(authCookie)?.value);
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  return null;
}

export function getSessionFromRequest(request: NextRequest): SessionData | null {
  return getAuthFromCookies(request.cookies.get(authCookie)?.value);
}

export function requireInternalAuth(request: NextRequest): NextResponse | null {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const expected = process.env.INTERNAL_API_TOKEN;

  // Em producao (Vercel), INTERNAL_API_TOKEN e obrigatorio.
  // Se nao estiver configurado, rejeita a requisicao.
  if (!expected) {
    if (process.env.VERCEL) {
      console.error("[auth] INTERNAL_API_TOKEN nao configurado — requisicao interna rejeitada em producao");
      return NextResponse.json({ error: "Token interno nao configurado." }, { status: 500 });
    }
    // Em dev local, permite acesso sem token para facilitar o desenvolvimento.
    return null;
  }

  if (!token || token !== expected) {
    return NextResponse.json({ error: "Token invalido." }, { status: 401 });
  }
  return null;
}
