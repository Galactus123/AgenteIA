import { NextRequest, NextResponse, after } from "next/server";
import { handlePatientMessage } from "@/lib/agent/agent";
import {
  checkKomunikaNumber,
  parseKomunikaInbound,
  sendKomunikaMessage,
  verifyKomunikaSignature,
  cleanResponseText,
} from "@/lib/services/komunika";
import type { KomunikaInboundMessage } from "@/lib/services/komunika";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    console.log("[DEBUG 1] Chegada do payload no webhook:", rawBody);

    const signature = request.headers.get("x-komunika-signature");
    console.log("[webhook] Assinatura recebida:", signature ?? "(nenhuma)");

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

    const eventType = String(body.event ?? body.type ?? "");
    if (eventType && !RECEIVED_EVENTS.has(eventType)) {
      console.log("[webhook] Evento ignorado:", eventType);
      return NextResponse.json({ received: true, ignored: true });
    }

    const inbound = parseKomunikaInbound(body);
    if (!inbound) {
      console.log("[webhook] parseKomunikaInbound retornou null (mensagem do próprio bot ou incompleta).");
      return NextResponse.json({ received: true, ignored: true });
    }

    // Retorna 200 imediatamente para a Komunika (evita timeout) e processa
    // o fluxo da IA + envio da resposta em background via after().
    after(() => {
      void processInboundMessage(inbound);
    });
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[ERRO WEBHOOK FATAL]:", error);
    return NextResponse.json({ received: true });
  }
}

async function processInboundMessage(inbound: KomunikaInboundMessage): Promise<void> {
  try {
    console.log("[DEBUG 2] Início da chamada da OpenAI. phone=", inbound.phone);
    const result = await handlePatientMessage(inbound.phone, inbound.text);
    console.log("[DEBUG 3] Resposta retornada da OpenAI:", {
      reply: result.reply?.slice(0, 150),
      transferred: result.transferred,
    });

    if (result.reply) {
      const cleanReply = cleanResponseText(result.reply);
      if (!cleanReply) {
        console.error("[webhook] Resposta da IA vazia após limpeza para phone=", inbound.phone);
        return;
      }
      console.log("[DEBUG 4] Disparo de envio da mensagem para a API da Komunika. phone=", inbound.phone);
      const check = await checkKomunikaNumber(inbound.phone);
      if (check.ok && check.exists === false) {
        console.log(`[webhook] Número ${inbound.phone} sem WhatsApp — resposta da IA não enviada.`);
        return;
      }
      const sendResult = await sendKomunikaMessage(inbound.phone, cleanReply, { type: "text" });
      console.log("[webhook] Status Komunika:", sendResult.status);
      if (!sendResult.ok) {
        console.error(
          `[webhook] Falha ao enviar resposta para ${inbound.phone}: status=${sendResult.status} error=${sendResult.error}`
        );
      }
    }

    if (result.transferred) {
      console.log("[DEBUG 4] Disparo de envio da mensagem para a API da Komunika (transferência). phone=", inbound.phone);
      const transferCheck = await checkKomunikaNumber(inbound.phone);
      if (transferCheck.ok && transferCheck.exists === false) {
        console.log(`[webhook] Número ${inbound.phone} sem WhatsApp — aviso de transferência não enviado.`);
        return;
      }
      const transferResult = await sendKomunikaMessage(inbound.phone, HUMAN_TRANSFER_NOTICE, { type: "text" });
      console.log("[webhook] Status Komunika (transfer):", transferResult.status);
      if (!transferResult.ok) {
        console.error(
          `[webhook] Falha ao enviar aviso de transferência para ${inbound.phone}: status=${transferResult.status} error=${transferResult.error}`
        );
      }
    }
  } catch (error) {
    console.error("[ERRO WEBHOOK FATAL]:", error);
  }
}