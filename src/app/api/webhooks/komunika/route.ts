import { NextRequest, NextResponse, after } from "next/server";
import { waitUntil } from "@vercel/functions";
import { handlePatientMessage } from "@/lib/agent/agent";
import {
  parseKomunikaInbound,
  sendKomunikaTyping,
  verifyKomunikaSignature,
} from "@/lib/services/komunika";
import type { KomunikaInboundMessage } from "@/lib/services/komunika";
import { isValidPayloadSize } from "@/lib/agent/security";
import { HUMAN_TRANSFER_NOTICE } from "@/lib/services/transfers";
import { enqueueOutboxMessage, processOutboxInBackground } from "@/lib/services/outbox";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Estende o tempo máximo de execução para o fluxo (typing + OpenAI +
// enqueue) rodar em background sem ser cancelado pelo runtime serverless.
export const maxDuration = 60;

// Tipos de evento de mensagens RECEBIDAS do cliente que disparam o fluxo da IA.
// "message.sent" ou from_me==true (mensagens do próprio bot) continuam ignorados.
const RECEIVED_EVENTS = new Set([
  "message.received",
  "message.inbound",
  "message.created",
  "incoming_message",
  "message",
]);

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-komunika-signature",
    },
  });
}

export async function POST(request: NextRequest) {
  // Anti-DoS/forca bruta de assinatura: janela por IP antes de ler o corpo.
  const limited = rateLimit(`webhook:komunika:${clientIp(request)}`, 60, 60_000);
  if (!limited.ok) return tooManyRequests(limited.retryAfterSec);

  try {
    const rawBody = await request.text().catch(() => "");
    console.log("[webhook] Payload recebido, tamanho:", rawBody.length);

    // Validar tamanho maximo do payload (anti-DoS)
    if (!isValidPayloadSize(rawBody)) {
      console.error("[webhook] Payload excede tamanho maximo (100KB)");
      return NextResponse.json({ error: "Payload muito grande." }, { status: 413 });
    }

    const signature = request.headers.get("x-komunika-signature");
    console.log("[webhook] Assinatura:", signature ? "presente" : "ausente");

    if (!verifyKomunikaSignature(rawBody, signature)) {
      console.error("[webhook] Assinatura inválida — rejeitando requisição");
      return NextResponse.json({ error: "Assinatura inválida." }, { status: 401 });
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody);
    } catch {
      // Sem logar o erro bruto: a mensagem do V8 cita um trecho do JSON
      // (conteudo da conversa = PII).
      console.error("[webhook] Body inválido — JSON parse falhou", "tamanho:", rawBody.length);
      return NextResponse.json({ error: "Body inválido." }, { status: 400 });
    }

    // Filtrar tipos de evento: apenas mensagens recebidas disparam o fluxo da IA.
    // Mensagens enviadas pelo bot (message.sent) ou outros eventos sao ignorados.
    const eventType = String(body.event ?? body.type ?? "").toLowerCase();
    if (eventType && !RECEIVED_EVENTS.has(eventType)) {
      console.log("[webhook] Evento ignorado:", eventType);
      return NextResponse.json({ received: true, ignored: true });
    }

    const inbound = parseKomunikaInbound(body);
    if (!inbound) {
      console.log("[webhook] parseKomunikaInbound retornou null (mensagem do próprio bot ou incompleta).");
      return NextResponse.json({ received: true, ignored: true });
    }

    // Garante que o processamento da IA + enqueue nao seja cancelado
    // pelo runtime serverless. No Vercel usa waitUntil() (@vercel/functions),
    // que estende a vida da invocacao ate o promise resolver; em dev local cai
    // no after() do Next.js (que internamente tambem usa waitUntil no Vercel).
    const task = processInboundMessage(inbound);
    const hasVercelCtx = Boolean(
      (globalThis as Record<symbol, unknown>)[Symbol.for("@vercel/request-context")]
    );
    if (hasVercelCtx) {
      waitUntil(task);
    } else {
      after(() => task);
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    // Fase 3.4: erro FATAL (sincrono, antes do ack) devolve 5xx para a
    // KOMUNIKA reenviar o webhook — antes retornavamos 200 e perdiamos
    // a mensagem. Ja o processamento assincrono abaixo nao tem como
    // mudar a resposta ja enviada; por isso as respostas de saida vao
    // para a fila outbox, que reprocessa com backoff.
    console.error("[ERRO WEBHOOK FATAL]:", error);
    return NextResponse.json(
      { error: "Falha interna ao processar o webhook." },
      { status: 500 }
    );
  }
}

async function processInboundMessage(inbound: KomunikaInboundMessage): Promise<void> {
  try {
    // Envia o indicador "digitando..." e AGUARDA a confirmação antes de chamar a OpenAI.
    console.log("[webhook] Enviando indicador de typing...");
    const typingResult = await sendKomunikaTyping(inbound.phone, { type: "composing" });
    console.log("[webhook] Typing status:", typingResult.ok ? "ok" : "falhou");
    if (!typingResult.ok) {
      console.error(
        `[webhook] Falha ao enviar typing: status=${typingResult.status} error=${typingResult.error}`
      );
    }

    console.log("[webhook] Processando mensagem via IA...");
    const result = await handlePatientMessage(inbound.phone, inbound.text);
    console.log("[webhook] IA respondeu: transferred=", result.transferred, "reply_len=", result.reply?.length ?? 0);

    let enqueued = false;

    if (result.reply) {
      // Resposta final da IA (inclui o proprio aviso de transferencia
      // quando a IA se despede) — entrega garantida via outbox.
      const outboxId = await enqueueOutboxMessage({
        phone: inbound.phone,
        text: result.reply,
        kind: result.transferred ? "transfer_notice" : "chat_reply",
        conversationId: result.conversationId,
      });
      enqueued ||= outboxId !== null;
      if (!outboxId) {
        console.error("[webhook] Falha ao enfileirar a resposta da IA.");
      }
    }

    // Rede de seguranca: transferida sem texto final (ex.: cota) —
    // garante que o paciente receba o aviso de atendimento humano.
    if (result.transferred && !result.reply) {
      const outboxId = await enqueueOutboxMessage({
        phone: inbound.phone,
        text: HUMAN_TRANSFER_NOTICE,
        kind: "transfer_notice",
        conversationId: result.conversationId,
      });
      enqueued ||= outboxId !== null;
      if (!outboxId) {
        console.error("[webhook] Falha ao enfileirar o aviso de transferencia.");
      }
    }

    // Dispara o envio imediato (e o reprocessamento de atrasados).
    if (enqueued) processOutboxInBackground();
  } catch (error) {
    console.error("[ERRO WEBHOOK FATAL]:", error);
  }
}
