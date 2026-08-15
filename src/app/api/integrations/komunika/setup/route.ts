import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireInternalAuth } from "@/lib/api-auth";
import { isKomunikaConfigured } from "@/lib/services/komunika";

export const runtime = "nodejs";

const baseUrl = () =>
  (process.env.KOMUNIKA_BASE_URL ?? "https://api.komunika.site/api/v1").replace(/\/+$/, "");

// Registra (ou atualiza) o endpoint de webhook da Komunika apontando para /api/webhooks/komunika
// Aceita autenticação via cookie de sessão OU via Bearer token (INTERNAL_API_TOKEN)
export async function POST(request: NextRequest) {
  const hasInternalToken = Boolean(process.env.INTERNAL_API_TOKEN);
  if (hasInternalToken) {
    const internalAuthError = requireInternalAuth(request);
    if (!internalAuthError) {
      // autenticou via INTERNAL_API_TOKEN — segue
    } else {
      const sessionAuthError = requireAuth(request);
      if (sessionAuthError) return sessionAuthError;
    }
  } else {
    const sessionAuthError = requireAuth(request);
    if (sessionAuthError) return sessionAuthError;
  }
  if (!isKomunikaConfigured()) {
    return NextResponse.json({ ok: false, error: "Komunika não configurado." }, { status: 400 });
  }
  const token = process.env.KOMUNIKA_API_TOKEN ?? "";
  if (!process.env.PUBLIC_URL) {
    return NextResponse.json(
      { ok: false, error: "Defina PUBLIC_URL para registrar o webhook." },
      { status: 400 }
    );
  }
  const webhookPath = `${process.env.PUBLIC_URL}/api/webhooks/komunika`;

  try {
    const header = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

    // A API da Komunika expõe webhooks em /webhooks (não /webhooks/endpoints).
    const existing = await fetch(`${baseUrl()}/webhooks`, { headers: header });
    const items = ((await existing.json().catch(() => [])) as { id?: string }[]) ?? [];
    const itemsArr = Array.isArray(items) ? items : (items as { data?: { id?: string }[] }).data ?? [];

    let endpointId: string | undefined;
    for (const item of itemsArr) {
      await fetch(`${baseUrl()}/webhooks/${item.id}`, {
        method: "DELETE",
        headers: header,
      });
    }

    const created = await fetch(`${baseUrl()}/webhooks`, {
      method: "POST",
      headers: header,
      body: JSON.stringify({
        url: webhookPath,
        events: ["message.received"],
        active: true,
      }),
    });
    const createdBody = (await created.json().catch(() => ({}))) as { id?: string; secret?: string };
    endpointId = createdBody.id;

    if (createdBody.secret) {
      console.log(`[komunika/setup] Novo webhook secret recebido. Atualize KOMUNIKA_WEBHOOK_SECRET nas variáveis de ambiente da Vercel.`);
    }

    return NextResponse.json({ ok: true, endpointId, url: webhookPath });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}