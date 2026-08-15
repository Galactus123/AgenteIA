import { db } from "@/lib/db";
import { todayStr, addDays } from "@/lib/datetime";

export interface DashboardStats {
  scheduled: number;
  cancelled: number;
  rescheduled: number;
  totalConversations: number;
  botMessages: number;
  conversionRate: number;
  activeDoctors: number;
  todayAppointments: { id: number; patient_name: string; doctor_name: string; specialty_name: string; starts_at: string; status: string }[];
}

export function getStats(): DashboardStats {
  const today = todayStr();
  const tomorrow = addDays(today, 1);

  const scheduled = db
    .prepare("SELECT COUNT(*) AS c FROM appointments WHERE status = 'scheduled'")
    .get() as { c: number };
  const cancelled = db
    .prepare("SELECT COUNT(*) AS c FROM appointments WHERE status = 'cancelled'")
    .get() as { c: number };
  const rescheduled = db
    .prepare("SELECT COUNT(*) AS c FROM appointments WHERE rescheduled = 1")
    .get() as { c: number };
  const totalConversations = db
    .prepare("SELECT COUNT(*) AS c FROM conversations")
    .get() as { c: number };
  const botMessages = db
    .prepare("SELECT COUNT(*) AS c FROM messages WHERE sender = 'bot'")
    .get() as { c: number };
  const activeDoctors = db
    .prepare("SELECT COUNT(*) AS c FROM doctors WHERE status = 'active'")
    .get() as { c: number };

  const conversions = db
    .prepare("SELECT COUNT(*) AS c FROM appointments WHERE source = 'ia' AND status = 'scheduled'")
    .get() as { c: number };
  const conversionRate =
    totalConversations.c > 0 ? Math.round((conversions.c / totalConversations.c) * 100) : 0;

  const todayAppointments = db
    .prepare(
      `SELECT a.id, a.patient_name, d.name AS doctor_name, s.name AS specialty_name, a.starts_at, a.status
       FROM appointments a
       JOIN doctors d ON d.id = a.doctor_id
       JOIN specialties s ON s.id = a.specialty_id
       WHERE a.starts_at >= ? AND a.starts_at < ?
       ORDER BY a.starts_at ASC`
    )
    .all(`${today} 00:00`, `${tomorrow} 00:00`) as unknown as DashboardStats["todayAppointments"];

  return {
    scheduled: scheduled.c,
    cancelled: cancelled.c,
    rescheduled: rescheduled.c,
    totalConversations: totalConversations.c,
    botMessages: botMessages.c,
    conversionRate,
    activeDoctors: activeDoctors.c,
    todayAppointments,
  };
}
