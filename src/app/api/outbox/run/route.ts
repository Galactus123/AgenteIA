import { NextRequest, NextResponse } from "next/server";
import { processOutbox } from "@/lib/services/outbox";
import { requireInternalAuth } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET = disparo do Vercel Cron / pg_cron do Supabase (reprocessamento
// da fila); POST = uso interno. Mesma protecao por token.
async function handle(request: NextRequest) {
  const authError = await requireInternalAuth(request);
  if (authError) return authError;
  const result = await processOutbox();
  return NextResponse.json({ ...result, at: new Date().toISOString() });
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
