import { NextRequest, NextResponse } from "next/server";
import { requireClinic } from "@/lib/api-auth";
import { listAuditLogs } from "@/lib/services/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Trilha de atividades da clínica (Fase 6.3). Acesso apenas com sessão;
// a tabela tem RLS deny-all e só é lida pelo service_role, e a listagem é
// sempre a da clínica da sessão (nunca a "primeira clínica" da base).
export async function GET(request: NextRequest) {
  const session = await requireClinic(request);
  if (session instanceof NextResponse) return session;

  const rawLimit = Number(request.nextUrl.searchParams.get("limit") ?? 100);
  const limit = Number.isFinite(rawLimit) ? rawLimit : 100;
  const events = await listAuditLogs({ clinicId: session.clinicId, limit });

  return NextResponse.json({ events });
}
