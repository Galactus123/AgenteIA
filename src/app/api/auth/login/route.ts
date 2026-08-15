import { NextRequest, NextResponse } from "next/server";
import { verifyPassword, createSessionToken, authCookie, getAdminByUsername } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const username = String(body?.username ?? "");
  const password = String(body?.password ?? "");
  if (!username || !password) {
    return NextResponse.json({ error: "Informe usuário e senha." }, { status: 400 });
  }
  if (!verifyPassword(username, password)) {
    return NextResponse.json({ error: "Credenciais inválidas." }, { status: 401 });
  }
  const admin = getAdminByUsername(username);
  if (!admin) {
    return NextResponse.json({ error: "Credenciais inválidas." }, { status: 401 });
  }
  const token = createSessionToken(admin.id, admin.role);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(authCookie, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
