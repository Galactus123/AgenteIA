import { createHmac, timingSafeEqual } from "node:crypto";

const baseUrl = () => (process.env.KOMUNIKA_BASE_URL ?? "https://api.komunika.site/api/v1").replace(/\/+$/, "");
const apiToken = () => process.env.KOMUNIKA_API_TOKEN ?? "";

export function isKomunikaConfigured(): boolean {
  const token = apiToken();
  const instanceId = process.env.KOMUNIKA_INSTANCE_ID ?? "";
  return Boolean(token && instanceId);
}

export interface KomunikaSendResult {
  ok: boolean;
  status?: number;
  messageId?: string;
  error?: string;
}

export async function sendKomunikaMessage(
  to: string,
  content: string,
  opts: { type?: string } = {}
): Promise<KomunikaSendResult> {
  if (!isKomunikaConfigured()) {
    return { ok: false, error: "Komunika não configurado." };
  }
  try {
    const res = await fetch(`${baseUrl()}/messages/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiToken()}`,
      },
      body: JSON.stringify({
        instanceId: process.env.KOMUNIKA_INSTANCE_ID,
        to,
        type: opts.type ?? "text",
        content,
      }),
    });
    const body = (await res.json().catch(() => null)) as {
      messageId?: string;
      message?: string;
      error?: string;
    } | null;
    if (!res.ok) {
      return { ok: false, status: res.status, error: body?.message ?? body?.error ?? res.statusText };
    }
    return { ok: true, status: res.status, messageId: body?.messageId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export function verifyKomunikaSignature(rawBody: Buffer | string, signature?: string | null): boolean {
  const secret = process.env.KOMUNIKA_WEBHOOK_SECRET ?? "";
  if (!secret) return true;
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export interface KomunikaInboundMessage {
  phone: string;
  text: string;
  instanceId?: string;
}

// Aceita os formatos de payload mais comuns (`data.text` / `data.message.content`,
// ou um body plano com `phone`/`from` + `text`/`content`).
export function parseKomunikaInbound(body: Record<string, unknown>): KomunikaInboundMessage | null {
  const data = (body.data ?? body) as Record<string, unknown>;
  const text = String(
    data.text ??
      extractMessageText(data.message ?? data.payload ?? data) ??
      body.text ??
      body.content ??
      ""
  ).trim();

   const phone = String(
     data.phone ??
       data.from ??
       (data.contact as { phone?: string } | undefined)?.phone ??
       ""
   ).replace(/\D/g, "");

  if (!phone || !text) return null;
  return { phone, text, instanceId: String(data.instanceId ?? process.env.KOMUNIKA_INSTANCE_ID ?? "") };
}

function extractMessageText(msg: unknown): string {
  if (typeof msg === "string") return msg;
  if (msg && typeof msg === "object") {
    const m = msg as Record<string, unknown>;
    if (typeof m.text === "string") return m.text;
    if (typeof m.content === "string") return m.content;
    if (typeof m.body === "string") return m.body;
  }
  return "";
}