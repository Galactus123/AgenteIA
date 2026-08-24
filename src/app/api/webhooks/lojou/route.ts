import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { hashSync } from "bcryptjs";
import { db } from "@/lib/db";
import { nowStr } from "@/lib/datetime";
import { isKomunikaConfigured, sendKomunikaMessage } from "@/lib/services/komunika";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── Tipos ──────────────────────────────────────────────────────────────────

interface LojouCustomer {
  name?: string;
  email?: string;
  phone?: string;
  first_name?: string;
  last_name?: string;
}

interface LojouOrder {
  id?: string;
  order_id?: string;
  product_id?: string;
  product_name?: string;
  customer?: LojouCustomer;
  // Campos alternativos no nível raiz
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  buyer_name?: string;
  buyer_email?: string;
  buyer_phone?: string;
  name?: string;
  email?: string;
  phone?: string;
}

interface LojouWebhookPayload {
  event?: string;
  type?: string;
  status?: string;
  order_type?: string;
  order?: LojouOrder;
  data?: LojouOrder;
  // Campos diretos no root
  order_id?: string;
  id?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function generateTempPassword(): string {
  return randomBytes(12).toString("base64url").slice(0, 16);
}

function extractSecret(request: NextRequest): string | null {
  const url = new URL(request.url);
  return url.searchParams.get("secret");
}

function resolveEventName(payload: LojouWebhookPayload): string {
  return (
    payload.event ??
    payload.type ??
    payload.status ??
    payload.order_type ??
    ""
  ).toLowerCase();
}

function extractOrderData(payload: LojouWebhookPayload): LojouOrder {
  return payload.order ?? payload.data ?? payload;
}

function resolveName(order: LojouOrder): string {
  const c = order.customer;
  if (c?.name) return c.name;
  if (c?.first_name || c?.last_name) {
    return `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim();
  }
  return (
    order.customer_name ??
    order.buyer_name ??
    order.name ??
    ""
  ).trim();
}

function resolveEmail(order: LojouOrder): string {
  const c = order.customer;
  return (
    c?.email ??
    order.customer_email ??
    order.buyer_email ??
    order.email ??
    ""
  ).trim().toLowerCase();
}

function resolvePhone(order: LojouOrder): string {
  const c = order.customer;
  return (
    c?.phone ??
    order.customer_phone ??
    order.buyer_phone ??
    order.phone ??
    ""
  ).replace(/\D/g, "").trim();
}

function resolveOrderId(order: LojouOrder): string {
  return String(order.id ?? order.order_id ?? "");
}

function resolveProductId(order: LojouOrder): string {
  return String(order.product_id ?? "");
}

// ── Handlers ───────────────────────────────────────────────────────────────

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    // 1. Validar secret via query string
    const secret = extractSecret(request);
    const expectedSecret = process.env.LOJOU_WEBHOOK_SECRET ?? "";
    if (expectedSecret && secret !== expectedSecret) {
      console.error("[lojou-webhook] Secret inválido — rejeitando requisição");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse do payload
    let body: LojouWebhookPayload;
    try {
      body = await request.json();
    } catch {
      console.error("[lojou-webhook] Body inválido — JSON parse falhou");
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    console.log("[lojou-webhook] Payload recebido:", JSON.stringify(body, null, 2));

    // 3. Verificar se é evento de pedido aprovado
    const eventName = resolveEventName(body);
    const APPROVED_EVENTS = new Set([
      "order_approved",
      "approved",
      "order.paid",
      "order.completed",
      "sale.approved",
      "payment.approved",
    ]);

    if (!APPROVED_EVENTS.has(eventName)) {
      console.log("[lojou-webhook] Evento ignorado:", eventName);
      return NextResponse.json({ received: true, ignored: true });
    }

    // 4. Extrair dados do pedido
    const order = extractOrderData(body);
    const name = resolveName(order);
    const email = resolveEmail(order);
    const phone = resolvePhone(order);
    const orderId = resolveOrderId(order);
    const productId = resolveProductId(order);

    if (!email) {
      console.error("[lojou-webhook] E-mail do cliente não encontrado no payload");
      return NextResponse.json({ error: "Missing customer email" }, { status: 422 });
    }

    console.log("[lojou-webhook] Dados extraídos:", { name, email, phone, orderId, productId });

    // 5. Verificar se o utilizador já existe
    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email) as { id: number } | undefined;
    if (existing) {
      console.log("[lojou-webhook] Utilizador já existe, ignorando. email:", email);
      return NextResponse.json({ success: true, user_id: existing.id, created: false });
    }

    // 6. Criar utilizador com senha provisória
    const tempPassword = generateTempPassword();
    const passwordHash = hashSync(tempPassword, 10);

    const result = db
      .prepare(
        `INSERT INTO users (name, email, phone, password_hash, lojou_order_id, product_id, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'active', ?)`
      )
      .run(name, email, phone, passwordHash, orderId, productId, nowStr());

    const userId = Number(result.lastInsertRowid);
    console.log("[lojou-webhook] Utilizador criado:", { userId, email });

    // 7. Enviar credenciais via Komunika WhatsApp
    if (phone && isKomunikaConfigured()) {
      const displayName = name || email.split("@")[0];
      const credsMessage = [
        `Olá ${displayName}! 🎉`,
        ``,
        `A sua conta SaúdeSync foi criada com sucesso!`,
        ``,
        `📧 E-mail: ${email}`,
        `🔑 Senha provisória: ${tempPassword}`,
        ``,
        `Pode alterar a senha após o primeiro login em:`,
        `${process.env.PUBLIC_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://syncbot-123.vercel.app"}/login`,
        ``,
        `Se precisar de ajuda, responda esta mensagem.`,
      ].join("\n");

      const sendResult = await sendKomunikaMessage(phone, credsMessage, { type: "text" });
      if (!sendResult.ok) {
        console.error("[lojou-webhook] Falha ao enviar credenciais via WhatsApp:", sendResult.error);
      } else {
        console.log("[lojou-webhook] Credenciais enviadas via WhatsApp para:", phone);
      }
    } else if (!phone) {
      console.warn("[lojou-webhook] Telefone não informado — credenciais não enviadas via WhatsApp");
    } else {
      console.warn("[lojou-webhook] Komunika não configurado — credenciais não enviadas");
    }

    // 8. Criar notificação no dashboard
    try {
      const { createNotification } = await import("@/lib/services/notifications");
      createNotification({
        type: "scheduled",
        title: "Nova conta criada via Lojou",
        message: `Conta criada para ${name || email} (pedido #${orderId || "N/A"}).`,
      });
    } catch {
      // Notificação é opcional — não falha o webhook
    }

    return NextResponse.json({ success: true, user_id: userId, created: true });
  } catch (error) {
    console.error("[lojou-webhook] Erro fatal:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
