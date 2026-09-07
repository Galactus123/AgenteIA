import { NextRequest, NextResponse } from "next/server";
import { verifyPassword, createSessionToken, authCookie, getAdminByIdentifier } from "@/lib/auth";
import { db } from "@/lib/db";
import { hashSync } from "bcryptjs";

const DEFAULT_ADMIN_USERNAME = "admin";
const DEFAULT_ADMIN_PASSWORD = "admin123";

function ensureAdminUser() {
  const existing = db.prepare("SELECT id FROM admins WHERE username = ?").get(DEFAULT_ADMIN_USERNAME);
  if (existing) return;
  db.prepare("INSERT INTO admins (username, password_hash, role, email) VALUES (?, ?, ?, ?)").run(
    DEFAULT_ADMIN_USERNAME,
    hashSync(DEFAULT_ADMIN_PASSWORD, 10),
    "super_admin",
    "admin@saudesync.mz"
  );
}

// ── Rate Limiting ──────────────────────────────────────────────────────
// Limite: 5 tentativas por 15 minutos por IP.
// Armazenado em memoria (reseta a cada reinicio do processo — aceitavel para SaaS inicial).
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutos

function checkRateLimit(ip: string): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const record = loginAttempts.get(ip);

  if (!record || now > record.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }

  if (record.count >= RATE_LIMIT_MAX) {
    const retryAfterMs = record.resetAt - now;
    return { allowed: false, retryAfterMs };
  }

  record.count++;
  return { allowed: true };
}

function isDefaultPassword(password: string): boolean {
  return password === DEFAULT_ADMIN_PASSWORD;
}

export async function POST(request: NextRequest) {
  // ── Rate limit ──────────────────────────────────────────────────────
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")
    ?? "unknown";

  const rateCheck = checkRateLimit(ip);
  if (!rateCheck.allowed) {
    const retryAfterSec = Math.ceil((rateCheck.retryAfterMs ?? 0) / 1000);
    return NextResponse.json(
      { error: `Multiplas tentativas falharam. Tente novamente em ${retryAfterSec}s.` },
      { status: 429 }
    );
  }

  // ── Validar body ────────────────────────────────────────────────────
  const body = await request.json().catch(() => null);
  const username = String(body?.username ?? "");
  const password = String(body?.password ?? "");
  if (!username || !password) {
    return NextResponse.json({ error: "Informe usuario e senha." }, { status: 400 });
  }

  ensureAdminUser();

  if (!verifyPassword(username, password)) {
    return NextResponse.json({ error: "Credenciais invalidas." }, { status: 401 });
  }

  const admin = getAdminByIdentifier(username);
  if (!admin) {
    return NextResponse.json({ error: "Credenciais invalidas." }, { status: 401 });
  }

  // ── Verificar se e senha padrao (forcar troca) ─────────────────────
  const adminRow = db
    .prepare("SELECT password_hash FROM admins WHERE id = ?")
    .get(admin.id) as { password_hash: string } | undefined;

  const mustChangePassword = adminRow ? isDefaultPassword(password) : false;

  const token = createSessionToken(admin.id, admin.role);
  const response = NextResponse.json({ ok: true, mustChangePassword });
  response.cookies.set(authCookie, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
