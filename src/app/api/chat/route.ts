import { NextRequest, NextResponse } from "next/server";
import { handlePatientMessage } from "@/lib/agent/agent";
import { requireAuth } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FALLBACK_PHONE = "+258 84 111 2222";

// Adaptador entre o painel de atendimento do SaúdeSync e o agente de IA real.
// Recebe a mensagem do usuário, encaminha para o agente (que agenda consultas
// no banco e devolve a resposta) e retorna em formato { resposta }.
export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  let body: { mensagem?: unknown; phone?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON inválido." }, { status: 400 });
  }

  const mensagem = String(body?.mensagem ?? "").trim();
  if (!mensagem) {
    return NextResponse.json({ error: "A propriedade 'mensagem' é obrigatória." }, { status: 400 });
  }

  const phone = String(body?.phone ?? "").trim() || FALLBACK_PHONE;
  console.log(`[api/chat:${new Date().toISOString()}] entrada → phone=${phone}, mensagem="${mensagem}"`);

  try {
    const result = await handlePatientMessage(phone, mensagem);
    console.log(`[api/chat:${new Date().toISOString()}] retorno → conversationId=${result.conversationId}, transferred=${result.transferred}, resposta="${result.reply.slice(0, 150)}"`);
    return NextResponse.json({
      resposta: result.reply,
      transferred: result.transferred,
      conversationId: result.conversationId,
    });
  } catch (err) {
    console.error("Erro ao processar mensagem no /api/chat:", err);
    return NextResponse.json(
      { error: "Falha ao comunicar com o agente de IA." },
      { status: 500 }
    );
  }
}
