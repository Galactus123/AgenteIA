import { db } from "@/lib/db";
import { nowStr } from "@/lib/datetime";
import { isKomunikaConfigured, sendKomunikaMessage } from "@/lib/services/komunika";
import type { Notification, NotificationType, NotificationChannelStatus } from "@/lib/types";

export function createNotification(data: {
  type: NotificationType;
  title: string;
  message: string;
  appointment_id?: number | null;
  doctor_id?: number | null;
}): Notification {
  const result = db
    .prepare(
      `INSERT INTO notifications (type, title, message, appointment_id, doctor_id, read, channel_status, created_at)
       VALUES (?, ?, ?, ?, ?, 0, 'pending', ?)`
    )
    .run(
      data.type,
      data.title,
      data.message,
      data.appointment_id ?? null,
      data.doctor_id ?? null,
      nowStr()
    );
  return db
    .prepare("SELECT * FROM notifications WHERE id = ?")
    .get(Number(result.lastInsertRowid)) as unknown as Notification;
}

export function listNotifications(opts?: {
  type?: NotificationType;
  unreadOnly?: boolean;
  limit?: number;
}): Notification[] {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (opts?.type) {
    conditions.push("type = ?");
    params.push(opts.type);
  }
  if (opts?.unreadOnly) {
    conditions.push("read = 0");
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = opts?.limit ?? 50;

  return db
    .prepare(`SELECT * FROM notifications ${where} ORDER BY created_at DESC LIMIT ?`)
    .all(...(params as (string | number)[]), limit) as unknown as Notification[];
}

export function getUnreadCount(): number {
  const row = db.prepare("SELECT COUNT(*) AS c FROM notifications WHERE read = 0").get() as { c: number };
  return row.c;
}

export function markAsRead(id: number): void {
  db.prepare("UPDATE notifications SET read = 1 WHERE id = ?").run(id);
}

export function markAllAsRead(): void {
  db.prepare("UPDATE notifications SET read = 1 WHERE read = 0").run();
}

export function updateChannelStatus(id: number, status: NotificationChannelStatus): void {
  db.prepare("UPDATE notifications SET channel_status = ? WHERE id = ?").run(status, id);
}

export function sendDoctorNotification(
  doctorPhone: string,
  doctorName: string,
  notification: Notification
): void {
  if (!doctorPhone || !isKomunikaConfigured()) {
    updateChannelStatus(notification.id, "failed");
    return;
  }

  const text = `[SaúdeSync] ${notification.title}\n\n${notification.message}`;

  sendKomunikaMessage(doctorPhone, text)
    .then((result) => {
      updateChannelStatus(notification.id, result.ok ? "sent" : "failed");
    })
    .catch(() => {
      updateChannelStatus(notification.id, "failed");
    });
}

export function notifyDoctorNewAppointment(
  doctorId: number,
  doctorName: string,
  doctorPhone: string,
  patientName: string,
  specialtyName: string,
  startsAt: string,
  appointmentId: number
): void {
  const time = startsAt.split(" ")[1] ?? startsAt;
  const date = startsAt.split(" ")[0] ?? "";
  const title = "Nova consulta agendada";
  const message = `O paciente ${patientName} agendou uma consulta de ${specialtyName} para ${date} às ${time}.`;

  const notification = createNotification({
    type: "scheduled",
    title,
    message,
    appointment_id: appointmentId,
    doctor_id: doctorId,
  });

  sendDoctorNotification(doctorPhone, doctorName, notification);
}

export function notifyDoctorCancelled(
  doctorId: number,
  doctorName: string,
  doctorPhone: string,
  patientName: string,
  specialtyName: string,
  startsAt: string,
  appointmentId: number
): void {
  const time = startsAt.split(" ")[1] ?? startsAt;
  const date = startsAt.split(" ")[0] ?? "";
  const title = "Consulta cancelada";
  const message = `O paciente ${patientName} cancelou a consulta de ${specialtyName} marcada para ${date} às ${time}.`;

  const notification = createNotification({
    type: "cancelled",
    title,
    message,
    appointment_id: appointmentId,
    doctor_id: doctorId,
  });

  sendDoctorNotification(doctorPhone, doctorName, notification);
}

export function notifyDoctorRescheduled(
  doctorId: number,
  doctorName: string,
  doctorPhone: string,
  patientName: string,
  specialtyName: string,
  oldStartsAt: string,
  newStartsAt: string,
  appointmentId: number
): void {
  const oldTime = oldStartsAt.split(" ")[1] ?? oldStartsAt;
  const newTime = newStartsAt.split(" ")[1] ?? newStartsAt;
  const newDate = newStartsAt.split(" ")[0] ?? "";
  const title = "Consulta remarcada";
  const message = `O paciente ${patientName} reagendou a consulta de ${specialtyName} de ${oldTime} para ${newDate} às ${newTime}.`;

  const notification = createNotification({
    type: "rescheduled",
    title,
    message,
    appointment_id: appointmentId,
    doctor_id: doctorId,
  });

  sendDoctorNotification(doctorPhone, doctorName, notification);
}

export function notifyDoctorReminder(
  doctorId: number,
  doctorName: string,
  doctorPhone: string,
  patientName: string,
  specialtyName: string,
  startsAt: string,
  appointmentId: number
): void {
  const time = startsAt.split(" ")[1] ?? startsAt;
  const title = "Lembrete de consulta";
  const message = `Consulta de ${specialtyName} com o paciente ${patientName} daqui 30 minutos (às ${time}).`;

  const notification = createNotification({
    type: "reminder",
    title,
    message,
    appointment_id: appointmentId,
    doctor_id: doctorId,
  });

  sendDoctorNotification(doctorPhone, doctorName, notification);
}
