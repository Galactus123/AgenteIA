import { NextRequest, NextResponse } from "next/server";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { hashSync } from "bcryptjs";
import { supabaseAdmin } from "@/lib/supabase";
import { nowStr } from "@/lib/datetime";
import { isKomunikaConfigured, sendKomunikaMessage, connectKomunikaInstanceForClinic, assignGlobalInstanceToClinicIfEmpty } from "@/lib/services/komunika";
import { isValidPayloadSize } from "@/lib/agent/security";
import { getPlanByLojouId } from "@/lib/plans";
import {
  createSubscription,
  updateSubscription,
  getSubscription,
} from "@/lib/services/plan-limits";
import { syncTokenLimitWithPlan } from "@/lib/services/subscriptions";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { maskEmail } from "@/lib/lgpd";

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

// Comparação em tempo constante via hash (digests têm tamanho fixo, ao
// contrário de timingSafeEqual direto sobre strings de tamanhos diferentes).
function constantTimeEquals(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

// HMAC-SHA256 hex do corpo bruto, comparado em tempo constante.
// Aceita o prefixo opcional "sha256=" (formato Stripe-style).
function isValidLojouSignature(
  rawBody: string,
  signature: string,
  secret: string
): boolean {
  const provided = signature.startsWith("sha256=") ? signature.slice(7) : signature;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return constantTimeEquals(provided.trim(), expected);
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

// ── Classificacao de eventos ───────────────────────────────────────────────

// Pagamento aprovado (compra avulsa ou ativacao de assinatura).
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

// Eventos de assinatura (criação/renovação): contidos em APPROVED_EVENTS,
// usados no handler para distinguir renovação de primeira ativação.
const SUBSCRIPTION_EVENTS = new Set([
  "subscription.created",
  "subscription.active",
  "subscription.renewed",
  "invoice.paid",
]);

// Eventos de cancelamento.
const CANCELLATION_EVENTS = new Set([
  "subscription.canceled",
  "subscription.cancelled",
  "subscription.expired",
]);

// Eventos de pagamento atrasado.
const PAST_DUE_EVENTS = new Set([
  "subscription.past_due",
  "subscription.payment_failed",
  "invoice.payment_failed",
]);

type SubscriptionEventStatus = "active" | "cancelled" | "past_due";

// O estado da assinatura e derivado do evento: um cancelamento NUNCA pode
// gravar "active" (bug original: todos os eventos gravavam active).
function resolveSubscriptionStatus(eventName: string): SubscriptionEventStatus {
  if (CANCELLATION_EVENTS.has(eventName)) return "cancelled";
  if (PAST_DUE_EVENTS.has(eventName)) return "past_due";
  return "active";
}

// ── Handlers ───────────────────────────────────────────────────────────────

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-lojou-signature",
    },
  });
}

export async function POST(request: NextRequest) {
  // Janela por IP antes de consumir corpo/CPU (forca bruta do secret da query).
  const limited = rateLimit(`webhook:lojou:${clientIp(request)}`, 60, 60_000);
  if (!limited.ok) return tooManyRequests(limited.retryAfterSec);

  try {
    // 0. Validar tamanho do payload (anti-DoS)
    const rawBody = await request.clone().text().catch(() => "");
    if (!isValidPayloadSize(rawBody)) {
      console.error("[lojou-webhook] Payload excede tamanho maximo (100KB)");
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }

    // 1. Fail-closed: sem LOJOU_WEBHOOK_SECRET configurado o webhook nao
    //    aceita nenhum payload (503 = erro de configuração do servidor,
    //    não do remetente).
    const expectedSecret = process.env.LOJOU_WEBHOOK_SECRET ?? "";
    if (!expectedSecret) {
      console.error(
        "[lojou-webhook] LOJOU_WEBHOOK_SECRET não configurado — rejeitando (fail-closed)"
      );
      return NextResponse.json(
        { error: "Webhook não configurado." },
        { status: 503 }
      );
    }

    // 2. Verificar assinatura: header HMAC (x-lojou-signature) quando a
    //    Lojou enviar; fallback ao secret na query string enquanto ela
    //    não assina os webhooks (docs.lojou.app/pt/webhooks).
    const headerSignature = request.headers.get("x-lojou-signature");
    let authorized: boolean;
    if (headerSignature) {
      authorized = isValidLojouSignature(rawBody, headerSignature, expectedSecret);
      if (!authorized) {
        console.error("[lojou-webhook] Assinatura HMAC inválida — rejeitando requisição");
      }
    } else {
      authorized = constantTimeEquals(extractSecret(request) ?? "", expectedSecret);
      if (!authorized) {
        console.error("[lojou-webhook] Secret inválido — rejeitando requisição");
      }
    }
    if (!authorized) {
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

    // 3. Verificar se e evento de pagamento/assinatura a processar
    const eventName = resolveEventName(body);
    const isPaymentConfirmedEvent = APPROVED_EVENTS.has(eventName);
    const isCancellationEvent = CANCELLATION_EVENTS.has(eventName);
    const isPastDueEvent = PAST_DUE_EVENTS.has(eventName);

    if (
      !isPaymentConfirmedEvent &&
      !isCancellationEvent &&
      !isPastDueEvent
    ) {
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

    // 5. Idempotência apenas da CRIAÇÃO do utilizador. O pagamento continua
    //    sempre a ser processado quando o utilizador ou o pedido já existem:
    //    caso contrário renovações, upgrades e reenvios do webhook nunca
    //    atualizariam o plano nem ativariam a instância da clínica.
    let userId: number | null = null;
    let created = false;

    if (orderId) {
      const { data: existingByOrder, error: orderByOrderError } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("lojou_order_id", orderId)
        .limit(1);
      if (orderByOrderError) {
        console.error("[lojou-webhook] Falha ao verificar pedido:", orderByOrderError.message);
      }
      if (existingByOrder?.length) {
        userId = Number(existingByOrder[0].id);
        console.log(
          "[lojou-webhook] Pedido ja processado (order_id) — utilizador existente, a seguir para a assinatura."
        );
      }
    }

    if (userId === null) {
      const { data: existingRows, error: existingError } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("email", email)
        .limit(1);
      if (existingError) {
        console.error("[lojou-webhook] Falha ao verificar utilizador:", existingError.message);
      }
      if (existingRows?.length) {
        userId = Number(existingRows[0].id);
        console.log(
          "[lojou-webhook] Utilizador ja existe — a seguir para a assinatura."
        );
      }
    }

    if (userId === null) {
      // 6. Criar utilizador com senha provisoria
      const tempPassword = generateTempPassword();
      const passwordHash = hashSync(tempPassword, 10);

      const { data: createdRow, error: createError } = await supabaseAdmin
        .from("users")
        .insert({
          name,
          email,
          phone,
          password_hash: passwordHash,
          lojou_order_id: orderId,
          product_id: productId,
          status: "active",
          created_at: nowStr(),
        })
        .select("id")
        .single();

      if (createError) {
        console.error("[lojou-webhook] Falha ao criar utilizador:", createError.message);
        return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
      }

      userId = Number(createdRow.id);
      created = true;
      console.log("[lojou-webhook] Utilizador criado: id=", userId);

      // 6.1 Enviar credenciais via Komunika WhatsApp
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

      // 6.2 Criar notificação no dashboard
      try {
        const { createNotification } = await import("@/lib/services/notifications");
        await createNotification({
          type: "scheduled",
          title: "Nova conta criada via Lojou",
          message: `Conta criada para ${name || email} (pedido #${orderId || "N/A"}).`,
        });
      } catch {
        // Notificação é opcional — não falha o webhook
      }
    }

    // 7. Pagamento confirmado: atualizar plano/assinatura (service role) e
    //    ativar a instancia WhatsApp da clinica (best-effort). Corre SEMPRE
    //    que o evento e relevante, quer o utilizador fosse novo ou ja existente.
    if (isPaymentConfirmedEvent || isCancellationEvent || isPastDueEvent) {
      await handleSubscriptionEvent({
        eventName,
        orderId,
        productId,
        email,
        userId,
        body,
      });
    }

    return NextResponse.json({ success: true, user_id: userId, created });
  } catch (error) {
    console.error("[lojou-webhook] Erro fatal:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ── Resolução da clínica do comprador ─────────────────────────────────────

// Resolve a clínica usando exclusivamente o service role (bypassa RLS):
//   1. clinic_members do utilizador autenticado (e-mail -> auth.users);
//   2. admins legado (e-mail/id) — mantém a compatibilidade com o seed;
//   3. primeira clínica registada (instalação single-tenant).
// Devolve null apenas quando não existe nenhuma clínica (nada a atualizar).
async function resolveClinicForSubscriber(
  email: string,
  userId: number
): Promise<number | null> {
  // 1. vínculo via auth (clinic_members.user_id -> auth.users)
  try {
    const authAdmin = (
      supabaseAdmin as unknown as {
        auth?: {
          admin?: {
            listUsers?: (opts: { page: number; perPage: number }) => Promise<{
              data: { users: Array<{ id: string; email?: string }> } | null;
              error: { message: string } | null;
            }>;
          };
        };
      }
    ).auth?.admin;
    if (authAdmin?.listUsers) {
      const { data, error } = await authAdmin.listUsers({ page: 1, perPage: 1000 });
      if (error) {
        console.error("[lojou-webhook] Falha ao listar utilizadores do auth:", error.message);
      } else {
        const authUser = (data?.users ?? []).find(
          (u) => (u.email ?? "").toLowerCase() === email
        );
        if (authUser) {
          const { data: member, error: memberError } = await supabaseAdmin
            .from("clinic_members")
            .select("clinic_id")
            .eq("user_id", authUser.id)
            .eq("active", true)
            .order("clinic_id", { ascending: true })
            .limit(1)
            .maybeSingle();
          if (memberError) {
            console.error(
              "[lojou-webhook] Falha ao consultar clinic_members:",
              memberError.message
            );
          } else if (member) {
            return Number(member.clinic_id);
          }
        }
      }
    }
  } catch (err) {
    console.error(
      "[lojou-webhook] Erro ao resolver a clínica via auth:",
      err instanceof Error ? err.message : String(err)
    );
  }

  // 2. admin legado (apenas para o log de diagnóstico)
  const { data: admins, error: adminError } = await supabaseAdmin
    .from("admins")
    .select("id")
    .or(`email.eq.${email},id.eq.${userId}`)
    .limit(1);
  if (adminError) {
    console.error("[lojou-webhook] Falha ao consultar admins:", adminError.message);
  }
  if (!admins?.length) {
    console.log(
      "[lojou-webhook] Admin legado não encontrado para o pagamento:",
      maskEmail(email ?? "")
    );
  }

  // 3. primeira clínica registada (fallback single-tenant)
  const { data: clinics, error: clinicError } = await supabaseAdmin
    .from("clinics")
    .select("id")
    .order("id", { ascending: true })
    .limit(1);
  if (clinicError) {
    console.error("[lojou-webhook] Falha ao resolver a clínica:", clinicError.message);
    return null;
  }
  const clinicId = clinics?.[0]?.id;
  return clinicId === undefined || clinicId === null ? null : Number(clinicId);
}

// Ativa/conecta a instância WhatsApp da clínica após o pagamento confirmado.
// Primeiro atribui a instância global à clínica se a coluna estiver vazia
// (a partir daí a atribuição fica explícita na BD); depois usa
// clinics.komunika_instance_id com fallback para KOMUNIKA_INSTANCE_ID
// global. Best-effort: qualquer falha é REGISTADA nos logs e nunca se
// propaga — o webhook tem de responder 200 à Lojou, senão ela reenvia o
// evento.
async function activateClinicWhatsAppInstance(clinicId: number): Promise<void> {
  try {
    await assignGlobalInstanceToClinicIfEmpty(clinicId);
    const result = await connectKomunikaInstanceForClinic(clinicId);
    const origem = result.source === "clinica" ? "própria da clínica" : "global do ambiente";
    if (result.ok) {
      console.log(
        `[lojou-webhook] Instância WhatsApp ativada para a clínica ${clinicId}: ` +
          `${result.instanceId} (instância ${origem}).`
      );
    } else {
      console.error(
        `[lojou-webhook] Falha ao ativar a instância WhatsApp da clínica ${clinicId} ` +
          `(${result.instanceId || "sem id"}, instância ${origem}):`,
        result.error
      );
    }
  } catch (err) {
    console.error(
      `[lojou-webhook] Exceção ao ativar a instância WhatsApp da clínica ${clinicId}:`,
      err
    );
  }
}

// ── Handler de pagamento/assinatura ───────────────────────────────────────

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
    const status = resolveSubscriptionStatus(eventName);

    // 1. Estado da assinatura no Supabase (service role)
    const clinicId = await resolveClinicForSubscriber(email, userId);
    if (clinicId === null) {
      console.log(
        "[lojou-webhook] Nenhuma clínica encontrada — plano e assinatura não atualizados."
      );
      return;
    }

    const priceId = body.price_id ?? productId;
    const plan = getPlanByLojouId(priceId);
    const existingSub = await getSubscription(clinicId);

    if (plan) {
      const now = nowStr();
      const periodStart = body.current_period_start ?? now;
      const periodEnd = body.current_period_end ?? now;
      const subscriptionId = body.subscription_id ?? orderId;

      if (existingSub && existingSub.status === status && existingSub.plan_id === plan.id) {
        console.log("[lojou-webhook] Assinatura já reflete este evento, escrita ignorada.");
      } else if (existingSub) {
        await updateSubscription(existingSub.id, {
          status,
          plan_id: plan.id,
          lojou_subscription_id: subscriptionId,
          current_period_start: periodStart,
          current_period_end: periodEnd,
          cancel_at_period_end: false,
        });
        console.log(
          `[lojou-webhook] Assinatura atualizada: clinic=${clinicId}, plan=${plan.id}, status=${status}`
        );
      } else if (status === "active") {
        await createSubscription({
          clinic_id: clinicId,
          plan_id: plan.id,
          lojou_customer_id: String(userId),
          lojou_subscription_id: subscriptionId,
          current_period_start: periodStart,
          current_period_end: periodEnd,
        });
        console.log(
          `[lojou-webhook] Assinatura criada: clinic=${clinicId}, plan=${plan.id}, status=active`
        );
      } else {
        console.log(
          `[lojou-webhook] Sem assinatura prévia para o evento "${eventName}" — nada a atualizar.`
        );
      }

      // Cota de tokens acompanha o plano: base_token_limit/token_limit em
      // clinics deixam de valer o default de 100k e passam a valer o teto do
      // plano ativado (preserva pacotes overage já comprados no ciclo).
      if (status === "active") {
        await syncTokenLimitWithPlan(clinicId, plan.id);
      }
    } else {
      console.log("[lojou-webhook] Plano não resolvido para price_id:", priceId);
      // Cancelamento/atraso continua a atualizar o estado mesmo sem plano
      // resolvível (o price_id pode já não estar no mapeamento).
      if (status !== "active" && existingSub) {
        await updateSubscription(existingSub.id, { status });
        console.log(
          `[lojou-webhook] Estado da assinatura atualizado: clinic=${clinicId}, status=${status}`
        );
      }
    }

    // 2. Pagamento confirmado → ativar a instância WhatsApp da clínica.
    if (status === "active") {
      await activateClinicWhatsAppInstance(clinicId);
    }

    // Notificar (opcional). Renovação = evento recorrente de assinatura
    // que não é a primeira ativação.
    const isRenewal =
      SUBSCRIPTION_EVENTS.has(eventName) &&
      eventName !== "subscription.created" &&
      eventName !== "subscription.active";
    try {
      const { createNotification } = await import("@/lib/services/notifications");
      await createNotification({
        type: "scheduled",
        title:
          status !== "active"
            ? `Assinatura ${status === "cancelled" ? "cancelada" : "em atraso"}`
            : `Assinatura ${isRenewal ? "renovada" : "ativada"}`,
        message: plan
          ? `Plano ${plan.name} ${status !== "active" ? "com estado " + status : isRenewal ? "renovado" : "ativado"} para a clínica.`
          : `Estado da assinatura alterado para ${status} na clínica.`,
      });
    } catch {
      // Notificação é opcional
    }
  } catch (err) {
    console.error("[lojou-webhook] Erro ao processar assinatura:", err);
  }
}
