import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import {
  getOrCreateConversation,
  getConversation,
  getConversationByPhone,
  addMessage,
  getMessages,
  listConversations,
} from "@/lib/services/conversations";

export async function GET(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const phone = request.nextUrl.searchParams.get("phone");
  const id = request.nextUrl.searchParams.get("id");

  if (phone) {
    const conversation = getConversationByPhone(phone);
    if (!conversation) {
      return NextResponse.json({ conversation: null, messages: [] });
    }
    return NextResponse.json({
      conversation,
      messages: getMessages(conversation.id),
    });
  }

  if (id) {
    const conversation = getConversation(Number(id));
    if (!conversation) {
      return NextResponse.json({ error: "Conversa não encontrada." }, { status: 404 });
    }
    return NextResponse.json({
      conversation,
      messages: getMessages(conversation.id),
    });
  }

  return NextResponse.json({ conversations: listConversations() });
}

export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  const { phone, message, sender } = body;

  if (!phone) {
    return NextResponse.json({ error: "Número de telefone é obrigatório." }, { status: 400 });
  }

  if (message !== undefined && message !== null && sender) {
    const conversation = getOrCreateConversation(phone);
    const added = addMessage(conversation.id, sender as "patient" | "bot" | "system", String(message));
    return NextResponse.json({ conversation, message: added }, { status: 201 });
  }

  if (message !== undefined && message !== null) {
    const conversation = getOrCreateConversation(phone);
    const added = addMessage(conversation.id, "patient", String(message));
    return NextResponse.json({ conversation, message: added }, { status: 201 });
  }

  const conversation = getOrCreateConversation(phone);
  return NextResponse.json({ conversation }, { status: 201 });
}
