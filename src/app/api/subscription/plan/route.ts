import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getClinicPlan, getActiveSubscription, getUsageDashboard } from "@/lib/services/plan-limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  try {
    const plan = getClinicPlan();
    const subscription = getActiveSubscription();
    const usage = getUsageDashboard();

    return NextResponse.json({
      plan: {
        id: plan.id,
        name: plan.name,
        price: plan.price,
        currency: plan.currency,
        billingInterval: plan.billingInterval,
        description: plan.description,
        features: plan.features,
      },
      subscription: subscription
        ? {
            status: subscription.status,
            currentPeriodStart: subscription.current_period_start,
            currentPeriodEnd: subscription.current_period_end,
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
          }
        : null,
      usage,
    });
  } catch (err) {
    console.error("[api/subscription/plan]", err);
    return NextResponse.json({ error: "Erro ao carregar plano." }, { status: 500 });
  }
}
