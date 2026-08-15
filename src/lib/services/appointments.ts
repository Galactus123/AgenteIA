import { db } from "@/lib/db";
import type { Appointment, AppointmentView, AvailableSlot } from "@/lib/types";
import {
  addMinutes,
  dateFromStr,
  formatDate,
  formatDateTime,
  nowStr,
  parseDatetime,
  todayStr,
  weekdayOf,
} from "@/lib/datetime";

const CANCEL_WINDOW_HOURS = 4;
const MAX_RESCHEDULES = 1;

export function listAppointments(): AppointmentView[] {
  const rows = db
    .prepare(
      `SELECT a.*, s.name AS specialty_name, d.name AS doctor_name, c.name AS clinic_name,
              c.address AS clinic_address, d.consultation_duration, d.price
       FROM appointments a
       JOIN specialties s ON s.id = a.specialty_id
       JOIN doctors d ON d.id = a.doctor_id
       JOIN clinics c ON c.id = (SELECT id FROM clinics LIMIT 1)
       ORDER BY a.starts_at DESC`
    )
    .all();
  return rows as unknown as AppointmentView[];
}

export function listAppointmentsFiltered(opts: {
  date?: string;
  status?: string;
}): AppointmentView[] {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (opts.date) {
    conditions.push("a.starts_at >= ? AND a.starts_at < ?");
    params.push(`${opts.date} 00:00`, `${opts.date} 23:59`);
  }
  if (opts.status) {
    conditions.push("a.status = ?");
    params.push(opts.status);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const rows = db
    .prepare(
      `SELECT a.*, s.name AS specialty_name, d.name AS doctor_name, c.name AS clinic_name,
              c.address AS clinic_address, d.consultation_duration, d.price
       FROM appointments a
       JOIN specialties s ON s.id = a.specialty_id
       JOIN doctors d ON d.id = a.doctor_id
       JOIN clinics c ON c.id = (SELECT id FROM clinics LIMIT 1)
       ${where}
       ORDER BY a.starts_at DESC`
    )
    .all(...(params as string[]));
  return rows as unknown as AppointmentView[];
}

export function getAppointment(id: number): Appointment | null {
  const row = db.prepare("SELECT * FROM appointments WHERE id = ?").get(id);
  return row ? (row as unknown as Appointment) : null;
}

export function getAppointmentView(id: number): AppointmentView | null {
  const row = db
    .prepare(
      `SELECT a.*, s.name AS specialty_name, d.name AS doctor_name, c.name AS clinic_name,
              c.address AS clinic_address, d.consultation_duration, d.price
       FROM appointments a
       JOIN specialties s ON s.id = a.specialty_id
       JOIN doctors d ON d.id = a.doctor_id
       JOIN clinics c ON c.id = (SELECT id FROM clinics LIMIT 1)
       WHERE a.id = ?`
    )
    .get(id);
  return row ? (row as unknown as AppointmentView) : null;
}

export function getAppointmentByConversation(conversationId: number): AppointmentView | null {
  const row = db
    .prepare(
      `SELECT a.*, s.name AS specialty_name, d.name AS doctor_name, c.name AS clinic_name,
              c.address AS clinic_address, d.consultation_duration, d.price
       FROM appointments a
       JOIN specialties s ON s.id = a.specialty_id
       JOIN doctors d ON d.id = a.doctor_id
       JOIN clinics c ON c.id = (SELECT id FROM clinics LIMIT 1)
       WHERE a.conversation_id = ? AND a.status = 'scheduled'
       ORDER BY a.starts_at DESC LIMIT 1`
    )
    .get(conversationId);
  return row ? (row as unknown as AppointmentView) : null;
}

export function findUpcomingAppointmentByPhone(phone: string): AppointmentView | null {
  const row = db
    .prepare(
      `SELECT a.*, s.name AS specialty_name, d.name AS doctor_name, c.name AS clinic_name,
              c.address AS clinic_address, d.consultation_duration, d.price
       FROM appointments a
       JOIN specialties s ON s.id = a.specialty_id
       JOIN doctors d ON d.id = a.doctor_id
       JOIN clinics c ON c.id = (SELECT id FROM clinics LIMIT 1)
       WHERE a.patient_phone = ? AND a.status = 'scheduled'
       ORDER BY a.starts_at ASC LIMIT 1`
    )
    .get(phone);
  return row ? (row as unknown as AppointmentView) : null;
}

function doctorHasAvailability(doctorId: number, startsAt: Date, durationMinutes: number): boolean {
  const end = addMinutes(startsAt, durationMinutes);
  const startStr = formatDateTime(startsAt);
  const endStr = formatDateTime(end);
  const conflict = db
    .prepare(
      `SELECT id FROM appointments
       WHERE doctor_id = ? AND status = 'scheduled' AND starts_at < ? AND ends_at > ?`
    )
    .get(doctorId, endStr, startStr);
  return !conflict;
}

export function isSlotAvailable(doctorId: number, startsAtStr: string): boolean {
  const doctor = db
    .prepare("SELECT consultation_duration FROM doctors WHERE id = ?")
    .get(doctorId) as { consultation_duration: number } | undefined;
  if (!doctor) return false;
  const startsAt = parseDatetime(startsAtStr);
  return doctorHasAvailability(doctorId, startsAt, doctor.consultation_duration);
}

export function getAvailableSlots(specialtyId: number, dateStr: string): AvailableSlot[] {
  const weekday = weekdayOf(dateStr);
  const dayStart = dateFromStr(dateStr);
  const now = new Date();
  const minStart = addMinutes(now, 2 * 60);

  const doctors = db
    .prepare("SELECT id, name, consultation_duration, price FROM doctors WHERE specialty_id = ? AND status = 'active'")
    .all(specialtyId) as { id: number; name: string; consultation_duration: number; price: number }[];

  const slots: AvailableSlot[] = [];
  for (const doctor of doctors) {
    const schedules = db
      .prepare("SELECT * FROM doctor_schedule WHERE doctor_id = ? AND weekday = ? ORDER BY start_time")
      .all(doctor.id, weekday) as { start_time: string; end_time: string }[];
    for (const sched of schedules) {
      const [sh, sm] = sched.start_time.split(":").map(Number);
      const [eh, em] = sched.end_time.split(":").map(Number);
      const start = new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate(), sh, sm);
      const end = new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate(), eh, em);
      let cursor = start;
      while (addMinutes(cursor, doctor.consultation_duration).getTime() <= end.getTime()) {
        const slotStart = new Date(cursor);
        const slotEnd = addMinutes(slotStart, doctor.consultation_duration);
        if (
          slotStart.getTime() >= minStart.getTime() &&
          doctorHasAvailability(doctor.id, slotStart, doctor.consultation_duration)
        ) {
          slots.push({
            doctor_id: doctor.id,
            doctor_name: doctor.name,
            specialty_id: specialtyId,
            specialty_name: "",
            starts_at: formatDateTime(slotStart),
            ends_at: formatDateTime(slotEnd),
            price: doctor.price,
          });
        }
        cursor = addMinutes(cursor, 30);
      }
    }
  }
  return slots.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}

export function getSpecialtyNames(): Record<number, string> {
  const rows = db.prepare("SELECT id, name FROM specialties").all() as { id: number; name: string }[];
  const map: Record<number, string> = {};
  for (const r of rows) map[r.id] = r.name;
  return map;
}

export function createAppointment(data: {
  patient_name: string;
  patient_phone: string;
  specialty_id: number;
  doctor_id: number;
  starts_at: string;
  reason?: string;
  source?: string;
  conversation_id?: number | null;
}): AppointmentView {
  const doctor = db
    .prepare("SELECT consultation_duration FROM doctors WHERE id = ?")
    .get(data.doctor_id) as { consultation_duration: number };
  const startsAt = parseDatetime(data.starts_at);
  const endsAt = addMinutes(startsAt, doctor.consultation_duration);
  const result = db
    .prepare(
      `INSERT INTO appointments
        (patient_name, patient_phone, specialty_id, doctor_id, starts_at, ends_at, status, reason, source, conversation_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'scheduled', ?, ?, ?, ?, ?)`
    )
    .run(
      data.patient_name,
      data.patient_phone,
      data.specialty_id,
      data.doctor_id,
      data.starts_at,
      formatDateTime(endsAt),
      data.reason ?? "",
      data.source ?? "ia",
      data.conversation_id ?? null,
      nowStr(),
      nowStr()
    );
  return getAppointmentView(Number(result.lastInsertRowid))!;
}

export function canCancel(appointment: Appointment): { ok: boolean; reason?: string } {
  if (appointment.status !== "scheduled") {
    return { ok: false, reason: "Esta consulta já não está ativa." };
  }
  const startsAt = parseDatetime(appointment.starts_at);
  const hours = (startsAt.getTime() - Date.now()) / 3600000;
  if (hours < CANCEL_WINDOW_HOURS) {
    return { ok: false, reason: "O cancelamento deve ser feito com pelo menos 4 horas de antecedência. Contacte a recepção." };
  }
  return { ok: true };
}

export function cancelAppointment(id: number): AppointmentView {
  const appointment = getAppointment(id);
  if (!appointment) throw new Error("Consulta não encontrada.");
  const check = canCancel(appointment);
  if (!check.ok) throw new Error(check.reason);
  db.prepare(
    "UPDATE appointments SET status = 'cancelled', cancelled_at = ?, updated_at = ? WHERE id = ?"
  ).run(nowStr(), nowStr(), id);
  return getAppointmentView(id)!;
}

export function canReschedule(appointment: Appointment): { ok: boolean; reason?: string } {
  if (appointment.status !== "scheduled") {
    return { ok: false, reason: "Esta consulta já não está ativa." };
  }
  if (appointment.reschedule_count >= MAX_RESCHEDULES) {
    return { ok: false, reason: "Esta consulta já foi remarcada uma vez. Contacte a recepção para novos ajustes." };
  }
  const startsAt = parseDatetime(appointment.starts_at);
  const hours = (startsAt.getTime() - Date.now()) / 3600000;
  if (hours < CANCEL_WINDOW_HOURS) {
    return { ok: false, reason: "A remarcação deve ser feita com pelo menos 4 horas de antecedência. Contacte a recepção." };
  }
  return { ok: true };
}

export function rescheduleAppointment(id: number, newStartsAt: string): AppointmentView {
  const appointment = getAppointment(id);
  if (!appointment) throw new Error("Consulta não encontrada.");
  const check = canReschedule(appointment);
  if (!check.ok) throw new Error(check.reason);
  const doctor = db
    .prepare("SELECT consultation_duration FROM doctors WHERE id = ?")
    .get(appointment.doctor_id) as { consultation_duration: number };
  const startsAt = parseDatetime(newStartsAt);
  const endsAt = addMinutes(startsAt, doctor.consultation_duration);
  if (!doctorHasAvailability(appointment.doctor_id, startsAt, doctor.consultation_duration)) {
    throw new Error("Este horário já não está disponível.");
  }
  db.prepare(
    "UPDATE appointments SET starts_at = ?, ends_at = ?, rescheduled = 1, reschedule_count = reschedule_count + 1, updated_at = ? WHERE id = ?"
  ).run(newStartsAt, formatDateTime(endsAt), nowStr(), id);
  return getAppointmentView(id)!;
}

export function listAppointmentsByDate(dateStr: string): AppointmentView[] {
  const next = dateFromStr(dateStr);
  next.setDate(next.getDate() + 1);
  const nextStr = formatDate(next);
  const rows = db
    .prepare(
      `SELECT a.*, s.name AS specialty_name, d.name AS doctor_name, c.name AS clinic_name,
              c.address AS clinic_address, d.consultation_duration, d.price
       FROM appointments a
       JOIN specialties s ON s.id = a.specialty_id
       JOIN doctors d ON d.id = a.doctor_id
       JOIN clinics c ON c.id = (SELECT id FROM clinics LIMIT 1)
       WHERE a.starts_at >= ? AND a.starts_at < ?
       ORDER BY a.starts_at ASC`
    )
    .all(`${dateStr} 00:00`, `${nextStr} 00:00`);
  return rows as unknown as AppointmentView[];
}

export function upcomingAppointments(): AppointmentView[] {
  const rows = db
    .prepare(
      `SELECT a.*, s.name AS specialty_name, d.name AS doctor_name, c.name AS clinic_name,
              c.address AS clinic_address, d.consultation_duration, d.price
       FROM appointments a
       JOIN specialties s ON s.id = a.specialty_id
       JOIN doctors d ON d.id = a.doctor_id
       JOIN clinics c ON c.id = (SELECT id FROM clinics LIMIT 1)
       WHERE a.status = 'scheduled' AND a.starts_at >= ?
       ORDER BY a.starts_at ASC`
    )
    .all(`${todayStr()} 00:00`);
  return rows as unknown as AppointmentView[];
}
