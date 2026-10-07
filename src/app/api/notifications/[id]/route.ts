import { NextRequest, NextResponse } from "next/server";
import { requireClinic } from "@/lib/api-auth";
import { markAsRead } from "@/lib/services/notifications";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(
  request: NextRequest,
  ctx: RouteContext
) {
  const session = await requireClinic(request);
  if (session instanceof NextResponse) return session;

  const { id } = await ctx.params;
  const notificationId = Number(id);

  if (isNaN(notificationId)) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }

  // Ownership: id de outra clínica não é atualizado nem confirmado (404).
  const updated = await markAsRead(notificationId, session.clinicId);
  if (!updated) {
    return NextResponse.json({ error: "Notificação não encontrada." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
