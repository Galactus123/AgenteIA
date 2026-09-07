import { NextRequest, NextResponse, after } from "next/server";
import { waitUntil } from "@vercel/functions";
import { handlePatientMessage } from "@/lib/agent/agent";
import {
  checkKomunikaNumber,
  parseKomunikaInbound,
  sendKomunikaMessage,
  sendKomunikaTyping,
  verifyKomunikaSignature,
  cleanResponseText,
} from "@/lib/services/komunika";
import type { KomunikaInboundMessage } from "@/lib/services/komunika";
import { isValidPayloadSize } from "@/lib/agent/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Estende o tempo máximo de execução para o fluxo (typing + OpenAI + envio)
// rodar em background sem ser cancelado pelo runtime serverless.
export const maxDuration = 60;

const HUMAN_TRANSFER_NOTICE =
  "Se preferir falar com um atendente agora, a recepcionista vai te atender em breve. Obrigado pela paciência!";

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
    } catch (err) {
      console.error("[webhook] Body inválido — JSON parse falhou:", err);
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

    // Garante que o processamento da IA + envio da Komunika não seja cancelado
    // pelo runtime serverless. No Vercel usa waitUntil() (@vercel/functions),
    // que estende a vida da invocação até o promise resolver; em dev local cai
    // no after() do Next.js (que internamente também usa waitUntil no Vercel).
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
    console.error("[ERRO WEBHOOK FATAL]:", error);
    return NextResponse.json({ received: true });
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

    if (result.reply) {
      const cleanReply = cleanResponseText(result.reply);
      if (!cleanReply) {
        console.error("[webhook] Resposta da IA vazia apos limpeza.");
        return;
      }
      console.log("[webhook] Verificando numero antes de enviar resposta...");
      const check = await checkKomunikaNumber(inbound.phone);
      if (check.ok && check.exists === false) {
        console.log(`[webhook] Numero sem WhatsApp — resposta nao enviada.`);
        return;
      }
      console.log("[webhook] Enviando resposta ao paciente...");
      const sendResult = await sendKomunikaMessage(inbound.phone, cleanReply, { type: "text" });
      console.log("[webhook] Envio:", sendResult.ok ? "ok" : "falhou status=" + sendResult.status);
      if (!sendResult.ok) {
        console.error(
          `[webhook] Falha ao enviar resposta: status=${sendResult.status} error=${sendResult.error}`
        );
      }
    }

    if (result.transferred) {
      console.log("[webhook] Verificando numero para transferencia...");
      const transferCheck = await checkKomunikaNumber(inbound.phone);
      if (transferCheck.ok && transferCheck.exists === false) {
        console.log(`[webhook] Numero sem WhatsApp — aviso de transferencia nao enviado.`);
        return;
      }
      console.log("[webhook] Enviando aviso de transferencia...");
      const transferResult = await sendKomunikaMessage(inbound.phone, HUMAN_TRANSFER_NOTICE, { type: "text" });
      console.log("[webhook] Transferencia:", transferResult.ok ? "ok" : "falhou status=" + transferResult.status);
      if (!transferResult.ok) {
        console.error(
          `[webhook] Falha ao enviar aviso de transferencia: status=${transferResult.status} error=${transferResult.error}`
        );
      }
    }
  } catch (error) {
    console.error("[ERRO WEBHOOK FATAL]:", error);
  }
}