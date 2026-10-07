import { NextRequest, NextResponse } from "next/server";
import { handlePatientMessage } from "@/lib/agent/agent";
import { requireClinic } from "@/lib/api-auth";
import { MAX_PATIENT_MESSAGE_LENGTH } from "@/lib/agent/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FALLBACK_PHONE = "+258 84 111 2222";

export async function POST(request: NextRequest) {
  const session = await requireClinic(request);
  if (session instanceof NextResponse) return session;

  let body: { mensagem?: unknown; phone?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON invalido." }, { status: 400 });
  }

  const mensagem = String(body?.mensagem ?? "").trim();
  if (!mensagem) {
    return NextResponse.json({ error: "A propriedade 'mensagem' e obrigatoria." }, { status: 400 });
  }

  // Validar tamanho maximo da mensagem
  if (mensagem.length > MAX_PATIENT_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: `Mensagem excede o limite de ${MAX_PATIENT_MESSAGE_LENGTH} caracteres.` },
      { status: 400 }
    );
  }

  const phone = String(body?.phone ?? "").trim() || FALLBACK_PHONE;

  // Limites de plano e cota de tokens valem para a clínica do utilizador.
  const clinicId = session.clinicId;

  try {
    const result = await handlePatientMessage(phone, mensagem, clinicId);
    return NextResponse.json({
      resposta: result.reply,
      transferred: result.transferred,
      conversationId: result.conversationId,
    });
  } catch (err) {
    // Mensagem do erro, nunca o objeto cru (pode ecoar conteudo da conversa).
    console.error("[api/chat] Erro ao processar mensagem:", err instanceof Error ? err.message : "erro desconhecido");
    return NextResponse.json(
      { error: "Falha ao comunicar com o agente de IA." },
      { status: 500 }
    );
  }
}
