import { NextRequest, NextResponse } from "next/server";
import { authCookie, getAuthFromCookies } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  const session = getAuthFromCookies(request.cookies.get(authCookie)?.value);
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 200 });
  }
  const admin = db
    .prepare("SELECT id, username, role, email FROM admins WHERE id = ?")
    .get(session.adminId) as
    | { id: number; username: string; role: string; email: string }
    | undefined;
  return NextResponse.json({
    authenticated: true,
    admin: admin
      ? { id: admin.id, username: admin.username, role: admin.role, email: admin.email }
      : null,
  });
}
