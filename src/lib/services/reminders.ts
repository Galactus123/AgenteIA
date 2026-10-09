import { supabaseAdmin } from "@/lib/supabase";
import type { AppointmentView } from "@/lib/types";
import { parseDatetime, nowStr } from "@/lib/datetime";
import { getOrCreateConversation, addMessage } from "@/lib/services/conversations";
import { enqueueOutboxMessage, processOutboxInBackground } from "@/lib/services/outbox";
import { notifyDoctorReminder } from "@/lib/services/notifications";

const VIEW_SELECT =
  "*, specialties(name), professionals(name, consultation_duration, price, phone), clinics(name, address)";

interface AppointmentRow extends Record<string, unknown> {
  specialties: { name?: string } | null;
  professionals: { name?: string; consultation_duration?: number; price?: number; phone?: string } | null;
  clinics: { name?: string; address?: string } | null;
}

function toView(row: AppointmentRow): AppointmentView {
  const base = { ...row } as unknown as Record<string, unknown>;
  delete base.specialties;
  delete base.professionals;
  delete base.clinics;
  delete base.doctor_id;

  return {
    ...(base as unknown as AppointmentView),
    specialty_name: row.specialties?.name ?? "",
    doctor_name: row.professionals?.name ?? "",
    clinic_name: row.clinics?.name ?? "",
    clinic_address: row.clinics?.address ?? "",
    consultation_duration: row.professionals?.consultation_duration ?? 0,
    price: Number(row.professionals?.price ?? 0),
  };
}

async function loadAppointments(): Promise<AppointmentView[]> {
  const { data, error } = await supabaseAdmin
    .from("appointments")
    .select(VIEW_SELECT)
    .eq("status", "scheduled")
    .order("starts_at", { ascending: true });

  if (error) {
    console.error("[reminders] Falha ao carregar consultas:", error.message);
    return [];
  }
  return ((data ?? []) as unknown as AppointmentRow[]).map(toView);
}

async function getProfessionalPhone(professionalId: string | null): Promise<string> {
  if (!professionalId) return "";
  const { data } = await supabaseAdmin
    .from("professionals")
    .select("phone")
    .eq("id", professionalId)
    .maybeSingle();
  return (data as { phone?: string } | null)?.phone ?? "";
}

// Registra o lembrete com INSERT idempotente (ON CONFLICT DO NOTHING
// via indice unico uq_reminders_appointment_type) e so entao entrega.
// Retorna true somente quando este chamado foi quem registrou — corrida
// entre execucoes concorrentes resolve no banco, nao na aplicacao.
async function sendReminder(appointment: AppointmentView, type: "24h" | "2h"): Promise<boolean> {
  // clinic_id da própria consulta (coluna presente no SELECT *) — conversa,
  // notificação do profissional e lembrete ficam na mesma clínica.
  const clinicId = (appointment as { clinic_id?: number }).clinic_id;
  const reminderRow: Record<string, unknown> = {
    appointment_id: appointment.id,
    type,
    sent_at: nowStr(),
  };
  if (clinicId !== undefined) reminderRow.clinic_id = clinicId;

  const { data: inserted, error } = await supabaseAdmin
    .from("reminders")
    .upsert(reminderRow, { onConflict: "appointment_id,type", ignoreDuplicates: true })
    .select("id");

  if (error) {
    console.error("[reminders] Falha ao registrar o lembrete:", error.message);
    return false;
  }
  if (!inserted?.length) return false; // ja registrado por outra execucao

  const when = type === "24h" ? "amanhã" : "hoje";
  const text = `Olá, ${appointment.patient_name}! Lembrete da sua consulta na ${appointment.clinic_name}: ${appointment.specialty_name} com ${appointment.doctor_name} ${when} às ${appointment.starts_at.split(" ")[1]}. Local: ${appointment.clinic_address}. Responda aqui se precisar remarcar ou cancelar.`;

  let conversationId = appointment.conversation_id;
  if (!conversationId) {
    const conversation = await getOrCreateConversation(appointment.patient_phone, clinicId);
    conversationId = conversation.id;
  }
  const outboxId = await enqueueOutboxMessage({
    phone: appointment.patient_phone,
    text,
    kind: "reminder",
    conversationId,
    clinicId,
  });
  if (!outboxId) {
    // Sem fila nao ha entrega garantida: desfaz o registro para a
    // proxima execucao tentar de novo (o indice unico garante 1 linha).
    await supabaseAdmin.from("reminders").delete().eq("id", inserted[0].id);
    console.error("[reminders] Lembrete devolvido (fila indisponivel); sera re-tentado.");
    return false;
  }

  try {
    await addMessage(conversationId, "bot", text);
  } catch (err) {
    console.error("[reminders] Falha ao gravar o lembrete no historico:", err);
  }

  try {
    const phone = await getProfessionalPhone(appointment.professional_id);
    if (phone) {
      await notifyDoctorReminder(
        appointment.professional_id,
        appointment.doctor_name,
        phone,
        appointment.patient_name,
        appointment.specialty_name,
        appointment.starts_at,
        appointment.id,
        clinicId
      );
    }
  } catch (err) {
    console.error("[reminders] Falha ao notificar o profissional:", err);
  }

  return true;
}

export async function runReminderCheck(now: Date = new Date()): Promise<number> {
  let sent = 0;
  for (const appointment of await loadAppointments()) {
    const startsAt = parseDatetime(appointment.starts_at);
    const hours = (startsAt.getTime() - now.getTime()) / 3600000;
    if (hours > 23.5 && hours <= 24.5) {
      if (await sendReminder(appointment, "24h")) sent++;
    } else if (hours > 1.5 && hours <= 2.5) {
      if (await sendReminder(appointment, "2h")) sent++;
    }
  }
  // Drena a fila (envio imediato + reprocessamento de atrasados).
  processOutboxInBackground();
  return sent;
}
