import { NextRequest, NextResponse } from "next/server";
import { requireClinic } from "@/lib/api-auth";
import {
  listNotifications,
  getUnreadCount,
  markAllAsRead,
} from "@/lib/services/notifications";
import type { NotificationType } from "@/lib/types";

export async function GET(request: NextRequest) {
  const session = await requireClinic(request);
  if (session instanceof NextResponse) return session;

  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get("type") as NotificationType | null;
  const unreadOnly = searchParams.get("unread") === "1";
  const limit = searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined;

  // As duas leituras são promessas reais: sem await o JSON serializaria
  // objetos vazios (bug original da rota de notificações).
  const [notifications, unreadCount] = await Promise.all([
    listNotifications({
      clinicId: session.clinicId,
      type: type ?? undefined,
      unreadOnly,
      limit,
    }),
    getUnreadCount(session.clinicId),
  ]);

  return NextResponse.json({ notifications, unreadCount });
}

export async function PATCH(request: NextRequest) {
  const session = await requireClinic(request);
  if (session instanceof NextResponse) return session;

  const body = await request.json().catch(() => null);
  if (body?.action === "read_all") {
    await markAllAsRead(session.clinicId);
    return NextResponse.json({ ok: true, unreadCount: 0 });
  }

  return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
}
