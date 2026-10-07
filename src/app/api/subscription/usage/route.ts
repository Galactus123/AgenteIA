import { NextRequest, NextResponse } from "next/server";
import { requireClinic } from "@/lib/api-auth";
import { getUsageDashboard, getWhatsappUsage, getAiUsage } from "@/lib/services/plan-limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await requireClinic(request);
  if (session instanceof NextResponse) return session;

  try {
    const clinicId = session.clinicId;
    const dashboard = await getUsageDashboard(clinicId);
    const whatsapp = await getWhatsappUsage(clinicId);
    const ai = await getAiUsage(clinicId);

    return NextResponse.json({
      dashboard,
      whatsapp: {
        current: whatsapp.current,
        limit: whatsapp.limit,
        remaining: whatsapp.remaining,
        percentage: whatsapp.percentage,
        allowed: whatsapp.allowed,
      },
      ai: {
        current: ai.current,
        limit: ai.limit,
        remaining: ai.remaining,
        percentage: ai.percentage,
        allowed: ai.allowed,
      },
    });
  } catch (err) {
    console.error("[api/subscription/usage]", err);
    return NextResponse.json({ error: "Erro ao carregar uso." }, { status: 500 });
  }
}
