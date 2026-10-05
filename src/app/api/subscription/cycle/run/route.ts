import { NextRequest, NextResponse } from "next/server";
import { runSubscriptionCycleCheck } from "@/lib/services/subscriptions";
import { requireInternalAuth } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET = disparo do Vercel Cron / pg_cron do Supabase (reset diario do
// ciclo de faturamento; a funcao so age no billing_cycle_day da clinica).
async function handle(request: NextRequest) {
  const authError = await requireInternalAuth(request);
  if (authError) return authError;
  await runSubscriptionCycleCheck();
  return NextResponse.json({ ok: true, at: new Date().toISOString() });
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
