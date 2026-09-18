import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { hashSync } from "bcryptjs";
import { db } from "@/lib/db";
import { nowStr } from "@/lib/datetime";
import { isKomunikaConfigured, sendKomunikaMessage } from "@/lib/services/komunika";
import { isValidPayloadSize } from "@/lib/agent/security";
import { getPlanByPriceId, type PlanId } from "@/lib/plans";
import {
  createSubscription,
  updateSubscription,
  getActiveSubscription,
} from "@/lib/services/plan-limits";

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
  // Campos de assinatura (quando aplicável)
  subscription_id?: string;
  customer_id?: string;
  price_id?: string;
  current_period_start?: string;
  current_period_end?: string;
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
    // 0. Validar tamanho do payload (anti-DoS)
    const rawBody = await request.clone().text().catch(() => "");
    if (!isValidPayloadSize(rawBody)) {
      console.error("[lojou-webhook] Payload excede tamanho maximo (100KB)");
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }

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

    console.log("[lojou-webhook] Payload recebido, tipo:", resolveEventName(body) || "desconhecido");

    // 3. Verificar se é evento de pedido aprovado
    const eventName = resolveEventName(body);
    const APPROVED_EVENTS = new Set([
      "order_approved",
      "approved",
      "order.paid",
      "order.completed",
      "sale.approved",
      "payment.approved",
      "subscription.created",
      "subscription.active",
      "subscription.renewed",
      "invoice.paid",
    ]);

    // Eventos de assinatura
    const SUBSCRIPTION_EVENTS = new Set([
      "subscription.created",
      "subscription.active",
      "subscription.renewed",
      "invoice.paid",
    ]);

    // Eventos de cancelamento
    const CANCELLATION_EVENTS = new Set([
      "subscription.canceled",
      "subscription.cancelled",
      "subscription.expired",
    ]);

    // Eventos de pagamento atrasado
    const PAST_DUE_EVENTS = new Set([
      "subscription.past_due",
      "subscription.payment_failed",
      "invoice.payment_failed",
    ]);

    const isSubscriptionEvent = SUBSCRIPTION_EVENTS.has(eventName);
    const isCancellationEvent = CANCELLATION_EVENTS.has(eventName);
    const isPastDueEvent = PAST_DUE_EVENTS.has(eventName);

    if (!APPROVED_EVENTS.has(eventName) && !isCancellationEvent && !isPastDueEvent) {
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

    console.log("[lojou-webhook] Dados extraidos: orderId=", orderId ? "presente" : "ausente", "email=", email ? "presente" : "ausente", "phone=", phone ? "presente" : "ausente");

    // 5. Verificar idempotencia: se ja existe um utilizador com este order_id, ignorar
    //    (previne duplicacao por reenvio do webhook)
    if (orderId) {
      const existingByOrder = db.prepare("SELECT id FROM users WHERE lojou_order_id = ?").get(orderId) as { id: number } | undefined;
      if (existingByOrder) {
        console.log("[lojou-webhook] Pedido ja processado (order_id), ignorando.");
        return NextResponse.json({ success: true, user_id: existingByOrder.id, created: false });
      }
    }

    // 6. Verificar se o utilizador ja existe por email
    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email) as { id: number } | undefined;
    if (existing) {
      console.log("[lojou-webhook] Utilizador ja existe, ignorando.");
      return NextResponse.json({ success: true, user_id: existing.id, created: false });
    }

    // 7. Criar utilizador com senha provisoria
    const tempPassword = generateTempPassword();
    const passwordHash = hashSync(tempPassword, 10);

    const result = db
      .prepare(
        `INSERT INTO users (name, email, phone, password_hash, lojou_order_id, product_id, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'active', ?)`
      )
      .run(name, email, phone, passwordHash, orderId, productId, nowStr());

    const userId = Number(result.lastInsertRowid);
    console.log("[lojou-webhook] Utilizador criado: id=", userId);

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
        console.log("[lojou-webhook] Credenciais enviadas via WhatsApp");
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

    // 9. Processar eventos de assinatura
    if (isSubscriptionEvent || isCancellationEvent || isPastDueEvent) {
      await handleSubscriptionEvent({
        eventName,
        orderId,
        productId,
        email,
        userId,
        body,
      });
    }

    return NextResponse.json({ success: true, user_id: userId, created: true });
  } catch (error) {
    console.error("[lojou-webhook] Erro fatal:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ── Handler de eventos de assinatura ──────────────────────────────────────

async function handleSubscriptionEvent(params: {
  eventName: string;
  orderId: string;
  productId: string;
  email: string;
  userId: number;
  body: LojouWebhookPayload;
}): Promise<void> {
  const { eventName, orderId, productId, email, userId, body } = params;

  try {
    // Resolver plano pelo product_id/price_id
    const priceId = body.price_id ?? productId;
    const plan = getPlanByPriceId(priceId);

    if (!plan) {
      console.log("[lojou-webhook] Plano não resolvido para price_id:", priceId);
      return;
    }

    // Buscar a clínica do utilizador (via admin_id)
    const admin = db.prepare("SELECT id FROM admins WHERE email = ? OR id = ?").get(email, userId) as { id: number } | undefined;
    if (!admin) {
      console.log("[lojou-webhook] Admin não encontrado para assinatura:", email);
      return;
    }

    const clinicRow = db.prepare("SELECT clinic_id FROM clinic_members WHERE admin_id = ? AND active = 1 LIMIT 1").get(admin.id) as { clinic_id: number } | undefined;
    const clinicId = clinicRow?.clinic_id ?? 1;

    // Verificar idempotência
    const existingSub = getActiveSubscription(clinicId);
    if (existingSub && existingSub.status === "active" && existingSub.plan_id === plan.id) {
      console.log("[lojou-webhook] Assinatura já ativa para este plano, ignorando.");
      return;
    }

    const now = nowStr();
    const periodStart = body.current_period_start ?? now;
    const periodEnd = body.current_period_end ?? now;
    const subscriptionId = body.subscription_id ?? orderId;

    if (existingSub) {
      // Atualizar assinatura existente
      updateSubscription(existingSub.id, {
        status: "active",
        plan_id: plan.id,
        lojou_subscription_id: subscriptionId,
        current_period_start: periodStart,
        current_period_end: periodEnd,
        cancel_at_period_end: 0,
      });
      console.log(`[lojou-webhook] Assinatura atualizada: clinic=${clinicId}, plan=${plan.id}`);
    } else {
      // Criar nova assinatura
      createSubscription({
        clinic_id: clinicId,
        plan_id: plan.id,
        lojou_customer_id: String(userId),
        lojou_subscription_id: subscriptionId,
        current_period_start: periodStart,
        current_period_end: periodEnd,
      });
      console.log(`[lojou-webhook] Assinatura criada: clinic=${clinicId}, plan=${plan.id}`);
    }

    // Notificar
    try {
      const { createNotification } = await import("@/lib/services/notifications");
      createNotification({
        type: "scheduled",
        title: `Assinatura ${eventName.includes("renewed") ? "renovada" : "ativada"}`,
        message: `Plano ${plan.name} ${eventName.includes("renewed") ? "renovado" : "ativado"} para a clínica.`,
      });
    } catch {
      // Notificação é opcional
    }
  } catch (err) {
    console.error("[lojou-webhook] Erro ao processar assinatura:", err);
  }
}
