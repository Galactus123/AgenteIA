import { NextRequest, NextResponse } from "next/server";
import { handlePatientMessage } from "@/lib/agent/agent";
import {
  parseKomunikaInbound,
  sendKomunikaMessage,
  verifyKomunikaSignature,
  cleanResponseText,
} from "@/lib/services/komunika";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HUMAN_TRANSFER_NOTICE =
  "Se preferir falar com um atendente agora, a recepcionista vai te atender em breve. Obrigado pela paciência!";

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
  const rawBody = await request.text().catch(() => "");
  console.log("[webhook] Payload recebido:", rawBody.slice(0, 2000));

  const signature = request.headers.get("x-komunika-signature");
  console.log("[webhook] Assinatura recebida:", signature ?? "(nenhuma)");
  console.log("[webhook] KOMUNIKA_WEBHOOK_SECRET definido:", Boolean(process.env.KOMUNIKA_WEBHOOK_SECRET));

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

  const event = String(body.event ?? body.type ?? "");
  console.log("[webhook] Evento:", event || "(vazio)");
  if (event && event !== "message.received" && event !== "message.inbound" && event !== "message") {
    console.log("[webhook] Evento ignorado:", event);
    return NextResponse.json({ received: true, ignored: true });
  }

  const inbound = parseKomunikaInbound(body);
  if (!inbound) {
    const data = (body.data ?? body) as Record<string, unknown>;
    console.log("[webhook] parseKomunikaInbound retornou null", {
      fromMe: data.fromMe ?? body.fromMe,
      phone: data.phone ?? data.from,
      text: data.text ?? data.content,
    });
    return NextResponse.json({ received: true, ignored: true });
  }

  console.log("[webhook] Mensagem válida:", { phone: inbound.phone, text: inbound.text.slice(0, 100) });

  try {
    const result = await handlePatientMessage(inbound.phone, inbound.text);
    console.log("[webhook] Resposta do agente:", { reply: result.reply?.slice(0, 150), transferred: result.transferred });

    if (result.reply) {
      const cleanReply = cleanResponseText(result.reply);
      if (!cleanReply) {
        console.error("[webhook] Resposta da IA vazia após limpeza para phone=", inbound.phone);
        return NextResponse.json({ received: true, error: "empty_reply" });
      }
      const sendResult = await sendKomunikaMessage(inbound.phone, cleanReply, { type: "text" });
      console.log("[webhook] Status Komunika:", sendResult.status);
      console.log("[webhook] Body Komunika:", JSON.stringify(sendResult.rawBody ?? { messageId: sendResult.messageId }));
      if (!sendResult.ok) {
        console.error(
          `[webhook] Falha ao enviar resposta para ${inbound.phone}: status=${sendResult.status} error=${sendResult.error}`
        );
      }
    }

    if (result.transferred) {
      const transferResult = await sendKomunikaMessage(inbound.phone, HUMAN_TRANSFER_NOTICE, { type: "text" });
      console.log("[webhook] Status Komunika (transfer):", transferResult.status);
      console.log("[webhook] Body Komunika (transfer):", JSON.stringify(transferResult.rawBody ?? { messageId: transferResult.messageId }));
    }
  } catch (err) {
    console.error(`[webhook] Erro ao processar mensagem de ${inbound.phone}:`, err);
  }

  return NextResponse.json({ received: true });
}
