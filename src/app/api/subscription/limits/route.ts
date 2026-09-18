import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import {
  canAddProfessional,
  canAddAdminUser,
  canAddUnit,
  canUseAI,
  canSendWhatsapp,
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

    const limits = {
      professionals: canAddProfessional(),
      adminUsers: canAddAdminUser(),
      units: canAddUnit(),
      ai: canUseAI(),
      whatsapp: canSendWhatsapp(),
    };

    if (feature) {
      return NextResponse.json({
        feature,
        allowed: hasFeature(undefined, feature),
      });
    }

    return NextResponse.json({ limits });
  } catch (err) {
    console.error("[api/subscription/limits]", err);
    return NextResponse.json({ error: "Erro ao verificar limites." }, { status: 500 });
  }
}
