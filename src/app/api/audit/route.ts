import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { listAuditLogs } from "@/lib/services/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Trilha de atividades da clínica (Fase 6.3). Acesso apenas com sessão;
// a tabela tem RLS deny-all e só é lida pelo service_role.
export async function GET(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const rawLimit = Number(request.nextUrl.searchParams.get("limit") ?? 100);
  const limit = Number.isFinite(rawLimit) ? rawLimit : 100;
  const events = await listAuditLogs({ limit });

  return NextResponse.json({ events });
}
