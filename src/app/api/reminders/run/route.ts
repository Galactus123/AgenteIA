import { NextRequest, NextResponse } from "next/server";
import { runReminderCheck } from "@/lib/services/reminders";
import { releaseNoShowAppointments } from "@/lib/services/appointments";
import { requireInternalAuth } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET = disparo do Vercel Cron / pg_cron do Supabase;
// POST = uso interno (mesma protecao por token).
async function handle(request: NextRequest) {
  const authError = await requireInternalAuth(request);
  if (authError) return authError;
  const sent = await runReminderCheck();
  // Fase 3.6: mesma varredura de 5 min tambem libera os horarios de
  // quem nao compareceu (scheduled vencido -> no_show).
  const released = await releaseNoShowAppointments();
  return NextResponse.json({ sent, released, at: new Date().toISOString() });
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
