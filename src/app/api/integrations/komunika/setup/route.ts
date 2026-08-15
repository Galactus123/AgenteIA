import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { isKomunikaConfigured } from "@/lib/services/komunika";

export const runtime = "nodejs";

const baseUrl = () =>
  (process.env.KOMUNIKA_BASE_URL ?? "https://api.komunika.site/api/v1").replace(/\/+$/, "");

// Registra (ou atualiza) o endpoint de webhook da Komunika apontando para /api/webhooks/komunika
export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;
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
      const fs = await import("node:fs");
      const path = await import("node:path");
      const envPath = path.join(process.cwd(), ".env");
      try {
        let env = fs.readFileSync(envPath, "utf8");
        if (new RegExp("^KOMUNIKA_WEBHOOK_SECRET=", "m").test(env)) {
          env = env.replace(/^KOMUNIKA_WEBHOOK_SECRET=.*$/m, `KOMUNIKA_WEBHOOK_SECRET=${createdBody.secret}`);
        } else {
          env += `\nKOMUNIKA_WEBHOOK_SECRET=${createdBody.secret}\n`;
        }
        fs.writeFileSync(envPath, env, "utf8");
      } catch {
        // falha ao atualizar o .env não impede o registro do webhook
      }
    }

    return NextResponse.json({ ok: true, endpointId, url: webhookPath });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}