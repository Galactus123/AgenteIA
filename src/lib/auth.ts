import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { compareSync } from "bcryptjs";

export type AdminRole = "admin" | "super_admin" | "saas_admin";

export interface SessionData {
  adminId: number;
  role: AdminRole;
}

const SESSION_COOKIE = "saudesync_session";
const SESSION_SECRET =
  process.env.SESSION_SECRET || "saudesync-dev-secret-change-in-production";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

function base64UrlEncode(input: string): string {
  return Buffer.from(input, "utf-8").toString("base64url");
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, "base64url").toString("utf-8");
}

function sign(payload: string): string {
  return createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
}

export function verifyPassword(username: string, password: string): boolean {
  const admin = db.prepare("SELECT password_hash FROM admins WHERE username = ?").get(username) as
    | { password_hash: string }
    | undefined;
  if (!admin) return false;
  try {
    return compareSync(password, admin.password_hash);
  } catch {
    return false;
  }
}

export function getAdminByUsername(username: string): { id: number; role: AdminRole } | null {
  const admin = db.prepare("SELECT id, role FROM admins WHERE username = ?").get(username) as
    | { id: number; role: string }
    | undefined;
  if (!admin) return null;
  return { id: admin.id, role: (admin.role as AdminRole) || "admin" };
}

export function createSessionToken(adminId: number, role: AdminRole): string {
  const payload = base64UrlEncode(
    JSON.stringify({ adminId, role, exp: Date.now() + SESSION_TTL_MS })
  );
  return `${payload}.${sign(payload)}`;
}

export function readSessionToken(token: string | undefined | null): SessionData | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  const sigBuf = Buffer.from(sig, "base64url");
  const expBuf = Buffer.from(expected, "base64url");
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;
  try {
    const data = JSON.parse(base64UrlDecode(payload)) as {
      adminId: number;
      role?: string;
      exp: number;
    };
    if (data.exp < Date.now()) return null;
    const exists = db.prepare("SELECT id FROM admins WHERE id = ?").get(data.adminId);
    if (!exists) return null;
    return { adminId: data.adminId, role: (data.role as AdminRole) || "admin" };
  } catch {
    return null;
  }
}

export const authCookie = SESSION_COOKIE;

export function getAuthFromCookies(cookieValue: string | undefined | null): SessionData | null {
  return readSessionToken(cookieValue);
}
