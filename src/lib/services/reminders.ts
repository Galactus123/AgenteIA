import { supabaseAdmin } from "@/lib/supabase";
import type { AppointmentView } from "@/lib/types";
import { parseDatetime, nowStr } from "@/lib/datetime";
import { getOrCreateConversation, addMessage } from "@/lib/services/conversations";
import { isKomunikaConfigured, sendKomunikaMessage } from "@/lib/services/komunika";
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

async function reminderAlreadySent(appointmentId: number, type: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("reminders")
    .select("id")
    .eq("appointment_id", appointmentId)
    .eq("type", type)
    .limit(1);

  if (error) {
    console.error("[reminders] Falha ao verificar lembrete:", error.message);
    return false;
  }
  return (data?.length ?? 0) > 0;
}

async function sendReminder(appointment: AppointmentView, type: "24h" | "2h"): Promise<void> {
  if (await reminderAlreadySent(appointment.id, type)) return;

  const when = type === "24h" ? "amanhã" : "hoje";
  const text = `Olá, ${appointment.patient_name}! Lembrete da sua consulta na ${appointment.clinic_name}: ${appointment.specialty_name} com ${appointment.doctor_name} ${when} às ${appointment.starts_at.split(" ")[1]}. Local: ${appointment.clinic_address}. Responda aqui se precisar remarcar ou cancelar.`;

  const { error } = await supabaseAdmin.from("reminders").insert({
    appointment_id: appointment.id,
    type,
    sent_at: nowStr(),
  });

  if (error) {
    console.error("[reminders] Falha ao registrar o lembrete:", error.message);
    return;
  }

  if (appointment.conversation_id) {
    await addMessage(appointment.conversation_id, "bot", text);
  } else {
    const conversation = await getOrCreateConversation(appointment.patient_phone);
    await addMessage(conversation.id, "bot", text);
  }

  if (isKomunikaConfigured()) {
    await sendKomunikaMessage(appointment.patient_phone, text, { type: "text" }).catch((err) => {
      console.error("[reminders] Falha ao enviar o lembrete via WhatsApp:", err);
    });
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
        appointment.id
      );
    }
  } catch (err) {
    console.error("[reminders] Falha ao notificar o profissional:", err);
  }
}

export async function runReminderCheck(now: Date = new Date()): Promise<number> {
  let sent = 0;
  for (const appointment of await loadAppointments()) {
    const startsAt = parseDatetime(appointment.starts_at);
    const hours = (startsAt.getTime() - now.getTime()) / 3600000;
    if (hours > 23.5 && hours <= 24.5) {
      await sendReminder(appointment, "24h");
      sent++;
    } else if (hours > 1.5 && hours <= 2.5) {
      await sendReminder(appointment, "2h");
      sent++;
    }
  }
  return sent;
}
