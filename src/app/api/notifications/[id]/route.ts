import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { markAsRead } from "@/lib/services/notifications";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(
  request: NextRequest,
  ctx: RouteContext
) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const { id } = await ctx.params;
  const notificationId = Number(id);

  if (isNaN(notificationId)) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }

  markAsRead(notificationId);
  return NextResponse.json({ ok: true });
}
