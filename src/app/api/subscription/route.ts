import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getSubscription, listAlerts } from "@/lib/services/subscriptions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Painel da clínica: status da subscrição, uso de tokens e alertas.
export async function GET(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const subscription = getSubscription();
  if (!subscription) {
    return NextResponse.json({ error: "Clínica não encontrada." }, { status: 404 });
  }

  return NextResponse.json({ subscription, alerts: listAlerts(30) });
}