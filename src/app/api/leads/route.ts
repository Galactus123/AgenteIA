import { NextRequest, NextResponse } from "next/server";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { parseTrialLead, saveTrialLead } from "@/lib/services/leads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── POST /api/leads — formulário público de teste grátis ────────────────────
//
// Publico de propósito (sem requireAuth): quem preenche ainda não tem
// conta. Proteções: rate-limit fino por IP (o proxy já aplica 300/min
// globais), limite de tamanho do corpo e validação server-side.
// As mensagens de erro são genéricas: nada de `error.message` cru.

const RATE_LIMIT_PER_HOUR = 5;
const HOUR_MS = 60 * 60 * 1_000;
const MAX_BODY_BYTES = 10_000;

export async function POST(request: NextRequest) {
  const limit = rateLimit(`leads:${clientIp(request)}`, RATE_LIMIT_PER_HOUR, HOUR_MS);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSec);

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Requisição demasiado grande." }, { status: 413 });
  }

  const rawBody = await request.text();
  if (rawBody.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Requisição demasiado grande." }, { status: 413 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const parsed = parseTrialLead(payload);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const saved = await saveTrialLead(parsed.value);
  if (!saved.ok) {
    return NextResponse.json(
      { error: "Não foi possível registar o seu pedido. Tente novamente em instantes." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, duplicate: saved.duplicate === true }, { status: 201 });
}
