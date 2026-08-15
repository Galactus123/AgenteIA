import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { handlePatientMessage } from "@/lib/agent/agent";
import {
  parseKomunikaInbound,
  sendKomunikaMessage,
  verifyKomunikaSignature,
} from "@/lib/services/komunika";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HUMAN_TRANSFER_NOTICE =
  "Se preferir falar com um atendente agora, a recepcionista vai te atender em breve. Obrigado pela paciência!";

// Escuta eventos de mensagens recebidas da Komunika, processa com o agente de IA
// e envia a resposta de volta ao WhatsApp.
//
// Responde 200 imediatamente e processa em segundo plano (via `after`) para não
// estourar o timeout do webhook, que pode desativar o endpoint após erros repetidos.
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

  after(async () => {
    try {
      const result = await handlePatientMessage(inbound.phone, inbound.text);
      if (result.reply) {
        await sendKomunikaMessage(inbound.phone, result.reply, { type: "text" });
      }
      if (result.transferred) {
        await sendKomunikaMessage(inbound.phone, HUMAN_TRANSFER_NOTICE, { type: "text" });
      }
    } catch {
      // o webhook já respondeu 200; não deixa o erro derrubar o processo
    }
  });

  return NextResponse.json({ received: true });
}
