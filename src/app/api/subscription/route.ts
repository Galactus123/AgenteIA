import { NextRequest, NextResponse } from "next/server";
import { requireClinic } from "@/lib/api-auth";
import { getSubscription, listAlerts } from "@/lib/services/subscriptions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Painel da clínica: status da subscrição, uso de tokens e alertas.
export async function GET(request: NextRequest) {
  const session = await requireClinic(request);
  if (session instanceof NextResponse) return session;

  const subscription = await getSubscription(session.clinicId);
  if (!subscription) {
    return NextResponse.json({ error: "Clínica não encontrada." }, { status: 404 });
  }

  return NextResponse.json({
    subscription,
    alerts: await listAlerts(30, session.clinicId),
  });
}
