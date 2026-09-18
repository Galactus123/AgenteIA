import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getPlan, type PlanId } from "@/lib/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CheckoutBody {
  planId: PlanId;
}

// Cria URL de checkout para o plano selecionado na LOJOU.
// O fluxo real de pagamento é processado pela LOJOU.
export async function POST(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  try {
    const body = (await request.json()) as CheckoutBody;
    const { planId } = body;

    if (!planId || !["start", "pro", "business", "enterprise"].includes(planId)) {
      return NextResponse.json({ error: "Plano inválido." }, { status: 400 });
    }

    const plan = getPlan(planId);

    // Enterprise: redirecionar para contato personalizado
    if (planId === "enterprise") {
      return NextResponse.json({
        type: "contact",
        message: "Para o plano Enterprise, entre em contato com nossa equipe comercial.",
        contactUrl: "mailto:contato@saudesync.com.br?subject=Plano%20Enterprise%20-%20Solicita%C3%A7%C3%A3o",
      });
    }

    // Mapear plan_id para price_id da LOJOU
    const priceIdMap: Record<string, string | undefined> = {
      start: process.env.LOJOU_START_PRICE_ID,
      pro: process.env.LOJOU_PRO_PRICE_ID,
      business: process.env.LOJOU_BUSINESS_PRICE_ID,
    };

    const priceId = priceIdMap[planId];
    if (!priceId) {
      console.error(`[checkout] LOJOU price ID não configurado para o plano ${planId}`);
      return NextResponse.json({
        type: "error",
        error: "Checkout não configurado para este plano. Entre em contato com o suporte.",
      }, { status: 500 });
    }

    // Construir URL de checkout da LOJOU
    // TODO: Adaptar para a URL real de checkout da LOJOU quando disponível
    const lojouBaseUrl = process.env.LOJOU_CHECKOUT_URL ?? "https://checkout.lojou.com";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://saudesync.com.br";

    const checkoutUrl = `${lojouBaseUrl}/checkout?price_id=${priceId}&success_url=${encodeURIComponent(`${appUrl}/configuracoes/assinatura?checkout=success`)}&cancel_url=${encodeURIComponent(`${appUrl}/precos?checkout=cancelled`)}`;

    return NextResponse.json({
      type: "checkout",
      checkoutUrl,
      plan: {
        id: plan.id,
        name: plan.name,
        price: plan.price,
        currency: plan.currency,
      },
    });
  } catch (err) {
    console.error("[api/subscription/checkout]", err);
    return NextResponse.json({ error: "Erro ao criar checkout." }, { status: 500 });
  }
}
