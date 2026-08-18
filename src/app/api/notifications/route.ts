import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import {
  listNotifications,
  getUnreadCount,
  markAllAsRead,
} from "@/lib/services/notifications";
import type { NotificationType } from "@/lib/types";

export async function GET(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get("type") as NotificationType | null;
  const unreadOnly = searchParams.get("unread") === "1";
  const limit = searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined;

  const notifications = listNotifications({
    type: type ?? undefined,
    unreadOnly,
    limit,
  });
  const unreadCount = getUnreadCount();

  return NextResponse.json({ notifications, unreadCount });
}

export async function PATCH(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const body = await request.json().catch(() => null);
  if (body?.action === "read_all") {
    markAllAsRead();
    return NextResponse.json({ ok: true, unreadCount: 0 });
  }

  return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
}
