import { NextRequest, NextResponse } from "next/server";
import { authCookie, getAuthFromCookies, verifyPassword } from "@/lib/auth";
import { db } from "@/lib/db";

export async function PUT(request: NextRequest) {
  const session = getAuthFromCookies(request.cookies.get(authCookie)?.value);
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const email = String(body?.email ?? "").trim();
  const currentPassword = String(body?.currentPassword ?? "");

  if (!email) {
    return NextResponse.json({ error: "Informe o novo e-mail." }, { status: 400 });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return NextResponse.json({ error: "Formato de e-mail inválido." }, { status: 400 });
  }

  if (!currentPassword) {
    return NextResponse.json(
      { error: "Informe a senha atual para confirmar a alteração." },
      { status: 400 }
    );
  }

  const admin = db
    .prepare("SELECT username FROM admins WHERE id = ?")
    .get(session.adminId) as { username: string } | undefined;

  if (!admin || !verifyPassword(admin.username, currentPassword)) {
    return NextResponse.json({ error: "Senha atual incorreta." }, { status: 403 });
  }

  db.prepare("UPDATE admins SET email = ? WHERE id = ?").run(email, session.adminId);

  return NextResponse.json({ ok: true, email });
}
