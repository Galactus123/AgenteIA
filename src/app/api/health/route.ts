import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// Ping real no banco com teto de 3s: o /api/health passou a ser o
// sinal de saude do deploy (smoke 7.1 + agendador diario da Fase 8.1),
// entao precisa saber se o PostgREST responde — sem vazar detalhes.
const DB_TIMEOUT_MS = 3000;

async function pingDatabase(): Promise<boolean> {
  try {
    const query = supabaseAdmin
      .from("clinics")
      .select("id")
      .limit(1)
      .maybeSingle()
      .then((r) => !r.error);

    const timeout = new Promise<false>((resolve) => {
      setTimeout(() => resolve(false), DB_TIMEOUT_MS);
    });

    return (await Promise.race([query, timeout])) === true;
  } catch {
    return false;
  }
}

export async function GET() {
  const database = (await pingDatabase()) ? "ok" : "fail";
  const ok = database === "ok";

  return NextResponse.json(
    {
      status: ok ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      checks: { database },
    },
    {
      status: ok ? 200 : 503,
      headers: { "cache-control": "no-store" },
    }
  );
}
