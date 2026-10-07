import { NextRequest, NextResponse } from "next/server";
import { requireAuth, resolveClinicId } from "@/lib/api-auth";
import { getSubscription, subscriptionGateEnabled } from "@/lib/services/plan-limits";
import { BILLING_PATH, isActiveSubscriptionStatus } from "@/lib/subscription-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Estado da subscrição da clínica. É o que o SubscriptionGuard do cliente
// consulta a cada navegação para decidir se bloqueia as páginas operacionais.
// Rota isenta do gate de assinatura em requireAuth (é ela própria que o
// expõe) — continua a exigir sessão válida.
export async function GET(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  // Fail-closed: sem vínculo de clínica não se consulta a "primeira clínica"
  // da base — devolve estado nenhum e o guard do cliente bloqueia as páginas.
  const clinicId = await resolveClinicId(request);
  const subscription = clinicId === null ? null : await getSubscription(clinicId);
  const gateDisabled = !subscriptionGateEnabled();

  return NextResponse.json(
    {
      // Gate desativado por env → o guard do cliente nunca bloqueia.
      active: gateDisabled || isActiveSubscriptionStatus(subscription?.status),
      gateDisabled,
      status: subscription?.status ?? "none",
      planId: subscription?.plan_id ?? null,
      currentPeriodEnd: subscription?.current_period_end ?? null,
      redirectTo: BILLING_PATH,
    },
    { headers: { "cache-control": "no-store" } }
  );
}
