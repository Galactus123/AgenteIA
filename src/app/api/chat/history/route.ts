import { NextRequest, NextResponse } from "next/server";
import { getConversationByPhone } from "@/lib/services/conversations";
import { getConversationMessages } from "@/lib/agent/agent";
import { requireAuth } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;
  const phone = request.nextUrl.searchParams.get("phone");
  if (!phone) return NextResponse.json({ error: "Número obrigatório." }, { status: 400 });
  const conversation = getConversationByPhone(phone);
  if (!conversation) return NextResponse.json({ conversation: null, messages: [] });
  return NextResponse.json(getConversationMessages(conversation.id));
}
