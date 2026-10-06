import { NextRequest, NextResponse } from "next/server";
import { requireAuth, resolveClinicId } from "@/lib/api-auth";
import {
  canAddProfessional,
  canAddAdminUser,
  canAddUnit,
  canUseAI,
  canSendWhatsapp,
  canCreateConversation,
  hasFeature,
} from "@/lib/services/plan-limits";
import type { FeatureId } from "@/lib/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  try {
    const url = new URL(request.url);
    const feature = url.searchParams.get("feature") as FeatureId | null;
    const clinicId = (await resolveClinicId(request)) ?? undefined;

    const limits = {
      professionals: await canAddProfessional(clinicId),
      adminUsers: await canAddAdminUser(clinicId),
      units: await canAddUnit(clinicId),
      ai: await canUseAI(clinicId),
      whatsapp: await canSendWhatsapp(clinicId),
      conversations: await canCreateConversation(clinicId),
    };

    if (feature) {
      return NextResponse.json({
        feature,
        allowed: await hasFeature(clinicId, feature),
      });
    }

    return NextResponse.json({ limits });
  } catch (err) {
    console.error("[api/subscription/limits]", err);
    return NextResponse.json({ error: "Erro ao verificar limites." }, { status: 500 });
  }
}
