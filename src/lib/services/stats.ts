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
  totalPatients: number;
  todayAppointments: { id: number; patient_name: string; doctor_name: string; specialty_name: string; starts_at: string; status: string }[];
  pendingRequests: { id: number; patient_name: string; patient_phone: string; specialty_name: string; preferred_date: string; preferred_time: string; reason: string; source: string; created_at: string }[];
  doctors: { id: number; name: string; specialty_name: string; status: string; schedule: { weekday: number; start_time: string; end_time: string }[] }[];
}

function safeCount(query: string, ...params: (string | number)[]): number {
  try {
    const row = db.prepare(query).get(...params) as { c: number } | undefined;
    return typeof row?.c === "number" ? row.c : 0;
  } catch {
    return 0;
  }
}

function safeAll<T>(query: string, ...params: (string | number)[]): T[] {
  try {
    const rows = db.prepare(query).all(...params);
    return Array.isArray(rows) ? (rows as T[]) : [];
  } catch {
    return [];
  }
}

export function getStats(): DashboardStats {
  const today = todayStr();
  const tomorrow = addDays(today, 1);

  const scheduled = safeCount("SELECT COUNT(*) AS c FROM appointments WHERE status = 'scheduled'");
  const cancelled = safeCount("SELECT COUNT(*) AS c FROM appointments WHERE status = 'cancelled'");
  const rescheduled = safeCount("SELECT COUNT(*) AS c FROM appointments WHERE rescheduled = 1");
  const totalConversations = safeCount("SELECT COUNT(*) AS c FROM conversations");
  const botMessages = safeCount("SELECT COUNT(*) AS c FROM messages WHERE sender = 'bot'");
  const activeDoctors = safeCount("SELECT COUNT(*) AS c FROM doctors WHERE status = 'active'");
  const totalPatients = safeCount("SELECT COUNT(DISTINCT patient_name) AS c FROM appointments");
  const conversions = safeCount("SELECT COUNT(*) AS c FROM appointments WHERE source = 'ia' AND status = 'scheduled'");

  const conversionRate = totalConversations > 0
    ? Math.round((conversions / totalConversations) * 100)
    : 0;

  const todayAppointments = safeAll<{
    id: number;
    patient_name: string;
    doctor_name: string;
    specialty_name: string;
    starts_at: string;
    status: string;
  }>(
    `SELECT a.id, a.patient_name, d.name AS doctor_name, s.name AS specialty_name, a.starts_at, a.status
     FROM appointments a
     JOIN doctors d ON d.id = a.doctor_id
     JOIN specialties s ON s.id = a.specialty_id
     WHERE a.starts_at >= ? AND a.starts_at < ?
     ORDER BY a.starts_at ASC`,
    `${today} 00:00`,
    `${tomorrow} 00:00`
  );

  const pendingRequests = safeAll<{
    id: number;
    patient_name: string;
    patient_phone: string;
    specialty_name: string;
    preferred_date: string;
    preferred_time: string;
    reason: string;
    source: string;
    created_at: string;
  }>(
    `SELECT a.id, a.patient_name, a.patient_phone, s.name AS specialty_name,
            substr(a.starts_at, 1, 10) AS preferred_date,
            substr(a.starts_at, 12, 5) AS preferred_time,
            a.reason, a.source, a.created_at
     FROM appointments a
     JOIN specialties s ON s.id = a.specialty_id
     WHERE a.status = 'scheduled' AND a.starts_at >= ? AND a.starts_at < ?
     ORDER BY a.starts_at ASC
     LIMIT 5`,
    `${today} 00:00`,
    `${tomorrow} 00:00`
  );

  const doctorRows = safeAll<{ id: number; name: string; specialty_name: string; status: string }>(
    `SELECT d.id, d.name, s.name AS specialty_name, d.status
     FROM doctors d
     JOIN specialties s ON s.id = d.specialty_id
     ORDER BY d.name`
  );

  const doctors = doctorRows.map((doc) => {
    const schedule = safeAll<{ weekday: number; start_time: string; end_time: string }>(
      "SELECT weekday, start_time, end_time FROM doctor_schedule WHERE doctor_id = ?",
      doc.id
    );
    return { ...doc, schedule };
  });

  return {
    scheduled,
    cancelled,
    rescheduled,
    totalConversations,
    botMessages,
    conversionRate,
    activeDoctors,
    totalPatients,
    todayAppointments,
    pendingRequests,
    doctors,
  };
}
