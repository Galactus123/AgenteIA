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
  const signature = request.headers.get("x-komunika-signature");
  if (!verifyKomunikaSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Assinatura inválida." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }

  const event = String(body.event ?? body.type ?? "");
  if (event && event !== "message.received" && event !== "message.inbound" && event !== "message") {
    return NextResponse.json({ received: true, ignored: true });
  }

  const inbound = parseKomunikaInbound(body);
  if (!inbound) {
    return NextResponse.json({ received: true, ignored: true });
  }

  // Processa tudo ANTES de retornar — evita que o serverless encerre antes do fetch
  try {
    const result = await handlePatientMessage(inbound.phone, inbound.text);

    if (result.reply) {
      const cleanReply = cleanResponseText(result.reply);
      if (!cleanReply) {
        console.error(`[webhook] Resposta da IA vazia após limpeza para phone=${inbound.phone}`);
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
