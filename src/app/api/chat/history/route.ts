import { NextRequest, NextResponse } from "next/server";
import { getConversationByPhone } from "@/lib/services/conversations";
import { getConversationMessages } from "@/lib/agent/agent";
import { requireClinic } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const session = await requireClinic(request);
  if (session instanceof NextResponse) return session;

  const phone = request.nextUrl.searchParams.get("phone");
  if (!phone) return NextResponse.json({ error: "Número obrigatório." }, { status: 400 });

  const conversation = await getConversationByPhone(phone, session.clinicId);
  if (!conversation) return NextResponse.json({ conversation: null, messages: [] });
  return NextResponse.json(await getConversationMessages(conversation.id));
}
