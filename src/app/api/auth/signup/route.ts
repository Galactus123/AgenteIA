import { NextRequest, NextResponse } from "next/server";
import { hashSync } from "bcryptjs";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Body invalido." }, { status: 400 });
  }

  const username = String(body.username ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  if (!username || !email || !password) {
    return NextResponse.json(
      { error: "Nome, e-mail e senha sao obrigatorios." },
      { status: 400 }
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "A senha deve ter no minimo 8 caracteres." },
      { status: 400 }
    );
  }

  // Verificar se o username ou email ja existem
  const existing = db
    .prepare("SELECT id FROM admins WHERE username = ? OR email = ?")
    .get(username, email) as { id: number } | undefined;

  if (existing) {
    return NextResponse.json(
      { error: "Usuario ou e-mail ja cadastrado." },
      { status: 409 }
    );
  }

  const passwordHash = hashSync(password, 10);

  const result = db
    .prepare("INSERT INTO admins (username, password_hash, role, email) VALUES (?, ?, ?, ?)")
    .run(username, passwordHash, "admin", email);

  const userId = Number(result.lastInsertRowid);
  console.log("[auth/signup] Novo admin criado: id=", userId, "role=admin");

  return NextResponse.json({ ok: true, userId }, { status: 201 });
}
