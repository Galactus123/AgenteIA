import { db } from "@/lib/db";
import type { AppointmentView } from "@/lib/types";
import { parseDatetime, nowStr } from "@/lib/datetime";
import { getOrCreateConversation, addMessage } from "@/lib/services/conversations";
import { isKomunikaConfigured, sendKomunikaMessage } from "@/lib/services/komunika";

function loadAppointments(): AppointmentView[] {
  return db
    .prepare(
      `SELECT a.*, s.name AS specialty_name, d.name AS doctor_name, c.name AS clinic_name,
              c.address AS clinic_address, d.consultation_duration, d.price
       FROM appointments a
       JOIN specialties s ON s.id = a.specialty_id
       JOIN doctors d ON d.id = a.doctor_id
       JOIN clinics c ON c.id = (SELECT id FROM clinics LIMIT 1)
       WHERE a.status = 'scheduled'`
    )
    .all() as unknown as AppointmentView[];
}

function sendReminder(appointment: AppointmentView, type: "24h" | "2h"): void {
  const already = db
    .prepare("SELECT id FROM reminders WHERE appointment_id = ? AND type = ?")
    .get(appointment.id, type);
  if (already) return;

  const when = type === "24h" ? "amanhã" : "hoje";
  const text = `Olá, ${appointment.patient_name}! Lembrete da sua consulta na ${appointment.clinic_name}: ${appointment.specialty_name} com ${appointment.doctor_name} ${when} às ${appointment.starts_at.split(" ")[1]}. Local: ${appointment.clinic_address}. Responda aqui se precisar remarcar ou cancelar.`;

  db.prepare("INSERT INTO reminders (appointment_id, type, sent_at) VALUES (?, ?, ?)").run(
    appointment.id,
    type,
    nowStr()
  );

  if (appointment.conversation_id) {
    addMessage(appointment.conversation_id, "bot", text);
  } else {
    const conversation = getOrCreateConversation(appointment.patient_phone);
    addMessage(conversation.id, "bot", text);
  }

  if (isKomunikaConfigured()) {
    sendKomunikaMessage(appointment.patient_phone, text);
  }
}

export function runReminderCheck(now: Date = new Date()): number {
  let sent = 0;
  for (const appointment of loadAppointments()) {
    const startsAt = parseDatetime(appointment.starts_at);
    const hours = (startsAt.getTime() - now.getTime()) / 3600000;
    if (hours > 23.5 && hours <= 24.5) {
      sendReminder(appointment, "24h");
      sent++;
    } else if (hours > 1.5 && hours <= 2.5) {
      sendReminder(appointment, "2h");
      sent++;
    }
  }
  return sent;
}
