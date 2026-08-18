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
  pendingRequests: { id: number; patient_name: string; patient_phone: string; specialty_name: string; preferred_date: string; preferred_time: string; reason: string; source: string; created_at: string }[];
  doctors: { id: number; name: string; specialty_name: string; status: string; schedule: { weekday: number; start_time: string; end_time: string }[] }[];
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

  const pendingRequests = db
    .prepare(
      `SELECT a.id, a.patient_name, a.patient_phone, s.name AS specialty_name,
              substr(a.starts_at, 1, 10) AS preferred_date,
              substr(a.starts_at, 12, 5) AS preferred_time,
              a.reason, a.source, a.created_at
       FROM appointments a
       JOIN specialties s ON s.id = a.specialty_id
       WHERE a.status = 'scheduled' AND a.starts_at >= ? AND a.starts_at < ?
       ORDER BY a.starts_at ASC
       LIMIT 5`
    )
    .all(`${today} 00:00`, `${tomorrow} 00:00`) as unknown as DashboardStats["pendingRequests"];

  const doctorRows = db
    .prepare(
      `SELECT d.id, d.name, s.name AS specialty_name, d.status
       FROM doctors d
       JOIN specialties s ON s.id = d.specialty_id
       ORDER BY d.name`
    )
    .all() as { id: number; name: string; specialty_name: string; status: string }[];

  const doctors = doctorRows.map((doc) => {
    const schedule = db
      .prepare("SELECT weekday, start_time, end_time FROM doctor_schedule WHERE doctor_id = ?")
      .all(doc.id) as { weekday: number; start_time: string; end_time: string }[];
    return { ...doc, schedule };
  });

  return {
    scheduled: scheduled.c,
    cancelled: cancelled.c,
    rescheduled: rescheduled.c,
    totalConversations: totalConversations.c,
    botMessages: botMessages.c,
    conversionRate,
    activeDoctors: activeDoctors.c,
    todayAppointments,
    pendingRequests,
    doctors,
  };
}
