import { supabaseAdmin } from "@/lib/supabase";
import type { Conversation, Message } from "@/lib/types";
import { nowStr } from "@/lib/datetime";
import {
  PlanLimitError,
  canCreateConversation,
  getWhatsappUsage,
  incrementWhatsappUsage,
} from "@/lib/services/plan-limits";

function fail(action: string, message: string): never {
  throw new Error(`[${action}] ${message}`);
}

// Limites do plano só entram na criação de uma conversa NOVA (já existente
// segue sempre). Levanta PlanLimitError — as rotas devolvem 402 e o agente
// responde o paciente sem gravar nada.
async function assertConversationAllowed(clinicId?: number | null): Promise<void> {
  const cid = clinicId ?? undefined;
  const [activeCheck, whatsappCheck] = await Promise.all([
    canCreateConversation(cid),
    getWhatsappUsage(cid),
  ]);

  if (!activeCheck.allowed) {
    throw new PlanLimitError(activeCheck.message, activeCheck.planName);
  }
  if (!whatsappCheck.allowed) {
    throw new PlanLimitError(
      whatsappCheck.message ?? `Limite de conversas WhatsApp do plano ${whatsappCheck.planName} atingido.`,
      whatsappCheck.planName
    );
  }
}

export async function getOrCreateConversation(
  phone: string,
  clinicId?: number | null
): Promise<Conversation> {
  const normalized = phone.replace(/\D/g, "");
  const now = nowStr();
  const scoped = clinicId ?? undefined;

  let readQuery = supabaseAdmin
    .from("conversations")
    .select("*")
    .eq("phone", normalized);
  if (scoped !== undefined) readQuery = readQuery.eq("clinic_id", scoped);
  const { data: existing, error: readError } = await readQuery.maybeSingle();

  if (readError) fail("conversations", readError.message);
  if (existing) return existing;

  await assertConversationAllowed(clinicId);

  const insertRow: Record<string, unknown> = {
    phone: normalized,
    patient_name: "",
    status: "open",
    created_at: now,
    updated_at: now,
  };
  // Conversa nova sempre nasce na clínica do chamador. Sem clinic_id
  // (webhook inbound sem clínica resolvida — Ponto 3) a coluna usa o default.
  if (scoped !== undefined) insertRow.clinic_id = scoped;

  const { data: created, error: insertError } = await supabaseAdmin
    .from("conversations")
    .insert(insertRow)
    .select("*")
    .single();

  if (!insertError && created) {
    // Conta a conversa no corte mensal de WhatsApp do plano (incremento
    // atómico; falhas são logadas dentro do serviço e não derrubam a criação).
    await incrementWhatsappUsage(clinicId ?? undefined);
    return created;
  }

  // 23505 = outra requisicao criou a mesma conversa entre o SELECT e o INSERT.
  if (insertError?.code === "23505") {
    let retryQuery = supabaseAdmin
      .from("conversations")
      .select("*")
      .eq("phone", normalized);
    if (scoped !== undefined) retryQuery = retryQuery.eq("clinic_id", scoped);
    const { data: concurrent } = await retryQuery.maybeSingle();
    if (concurrent) return concurrent;
  }

  fail("conversations", insertError?.message ?? "nao foi possivel criar a conversa");
}

// clinicId opcional para o agente (contexto inbound pode ainda não ter a
// clínica resolvida); quando chega, a leitura fica restrita a essa clínica.
export async function getConversation(
  id: number,
  clinicId?: number
): Promise<Conversation | null> {
  let query = supabaseAdmin.from("conversations").select("*").eq("id", id);
  if (clinicId !== undefined) query = query.eq("clinic_id", clinicId);
  const { data, error } = await query.maybeSingle();

  if (error) fail("conversations", error.message);
  return (data) ?? null;
}

export async function getConversationByPhone(
  phone: string,
  clinicId: number
): Promise<Conversation | null> {
  const normalized = phone.replace(/\D/g, "");
  const { data, error } = await supabaseAdmin
    .from("conversations")
    .select("*")
    .eq("phone", normalized)
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (error) fail("conversations", error.message);
  return (data) ?? null;
}

export async function updateConversation(
  id: number,
  data: { patient_name?: string; status?: string },
  clinicId?: number
): Promise<void> {
  const existing = await getConversation(id, clinicId);
  if (!existing) return;

  let query = supabaseAdmin
    .from("conversations")
    .update({
      patient_name: data.patient_name ?? existing.patient_name,
      status: data.status ?? existing.status,
      updated_at: nowStr(),
    })
    .eq("id", id);
  if (clinicId !== undefined) query = query.eq("clinic_id", clinicId);

  const { error } = await query;
  if (error) fail("conversations", error.message);
}

export async function addMessage(
  conversationId: number,
  sender: Message["sender"],
  content: string
): Promise<Message> {
  const { data: message, error } = await supabaseAdmin
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender,
      content,
      created_at: nowStr(),
    })
    .select("*")
    .single();

  if (error) fail("messages", error.message);

  const { error: touchError } = await supabaseAdmin
    .from("conversations")
    .update({ updated_at: nowStr() })
    .eq("id", conversationId);

  if (touchError) fail("conversations", touchError.message);

  return message;
}

export async function getMessages(conversationId: number): Promise<Message[]> {
  const { data, error } = await supabaseAdmin
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (error) fail("messages", error.message);
  return data ?? [];
}

export async function listConversations(clinicId: number): Promise<Conversation[]> {
  const { data, error } = await supabaseAdmin
    .from("conversations")
    .select("*")
    .eq("clinic_id", clinicId)
    .order("updated_at", { ascending: false });

  if (error) fail("conversations", error.message);
  return data ?? [];
}
