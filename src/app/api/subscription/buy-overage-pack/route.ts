import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { buyOveragePack } from "@/lib/services/subscriptions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Compra explícita de um pacote excedente de 50.000 tokens (gestor/admin da clínica).
export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  try {
    const result = buyOveragePack();
    return NextResponse.json(result);
  } catch (err) {
    console.error("[api/subscription/buy-overage-pack]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Falha ao adquirir o pacote excedente." },
      { status: 500 }
    );
  }
}