import { NextRequest, NextResponse } from "next/server";
import { requireClinic } from "@/lib/api-auth";
import { PlanLimitError } from "@/lib/services/plan-limits";
import {
  getOrCreateConversation,
  getConversation,
  getConversationByPhone,
  addMessage,
  getMessages,
  listConversations,
} from "@/lib/services/conversations";

export async function GET(request: NextRequest) {
  const session = await requireClinic(request);
  if (session instanceof NextResponse) return session;
  const { clinicId } = session;

  const phone = request.nextUrl.searchParams.get("phone");
  const id = request.nextUrl.searchParams.get("id");

  if (phone) {
    const conversation = await getConversationByPhone(phone, clinicId);
    if (!conversation) {
      return NextResponse.json({ conversation: null, messages: [] });
    }
    return NextResponse.json({
      conversation,
      messages: await getMessages(conversation.id),
    });
  }

  if (id) {
    const conversation = await getConversation(Number(id), clinicId);
    if (!conversation) {
      return NextResponse.json({ error: "Conversa não encontrada." }, { status: 404 });
    }
    return NextResponse.json({
      conversation,
      messages: await getMessages(conversation.id),
    });
  }

  return NextResponse.json({ conversations: await listConversations(clinicId) });
}

export async function POST(request: NextRequest) {
  const session = await requireClinic(request);
  if (session instanceof NextResponse) return session;
  const { clinicId } = session;

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  const { phone, message, sender } = body;

  if (!phone) {
    return NextResponse.json({ error: "Número de telefone é obrigatório." }, { status: 400 });
  }

  try {
    if (message !== undefined && message !== null && sender) {
      const conversation = await getOrCreateConversation(phone, clinicId);
      const added = await addMessage(
        conversation.id,
        sender as "patient" | "bot" | "system",
        String(message)
      );
      return NextResponse.json({ conversation, message: added }, { status: 201 });
    }

    if (message !== undefined && message !== null) {
      const conversation = await getOrCreateConversation(phone, clinicId);
      const added = await addMessage(conversation.id, "patient", String(message));
      return NextResponse.json({ conversation, message: added }, { status: 201 });
    }

    const conversation = await getOrCreateConversation(phone, clinicId);
    return NextResponse.json({ conversation }, { status: 201 });
  } catch (err) {
    // Conversas ativas / WhatsApp no limite do plano → 402 com o motivo.
    if (err instanceof PlanLimitError) {
      return NextResponse.json(
        { error: err.message, code: "PLAN_LIMIT", plan: err.planName },
        { status: 402 }
      );
    }
    console.error("[api/conversations]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Erro ao criar a conversa." }, { status: 500 });
  }
}
