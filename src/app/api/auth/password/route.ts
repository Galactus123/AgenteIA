import { NextRequest, NextResponse } from "next/server";
import { authCookie, getAuthFromCookies, verifyPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { hashSync } from "bcryptjs";

export async function PUT(request: NextRequest) {
  const session = getAuthFromCookies(request.cookies.get(authCookie)?.value);
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const currentPassword = String(body?.currentPassword ?? "");
  const newPassword = String(body?.newPassword ?? "");
  const confirmPassword = String(body?.confirmPassword ?? "");

  if (!currentPassword) {
    return NextResponse.json({ error: "Informe a senha atual." }, { status: 400 });
  }

  if (!newPassword) {
    return NextResponse.json({ error: "Informe a nova senha." }, { status: 400 });
  }

  if (newPassword.length < 8) {
    return NextResponse.json(
      { error: "A nova senha deve ter no mínimo 8 caracteres." },
      { status: 400 }
    );
  }

  if (newPassword !== confirmPassword) {
    return NextResponse.json(
      { error: "A confirmação da senha não confere." },
      { status: 400 }
    );
  }

  const admin = db
    .prepare("SELECT username FROM admins WHERE id = ?")
    .get(session.adminId) as { username: string } | undefined;

  if (!admin || !verifyPassword(admin.username, currentPassword)) {
    return NextResponse.json({ error: "Senha atual incorreta." }, { status: 403 });
  }

  const passwordHash = hashSync(newPassword, 10);
  db.prepare("UPDATE admins SET password_hash = ? WHERE id = ?").run(passwordHash, session.adminId);

  return NextResponse.json({ ok: true });
}
