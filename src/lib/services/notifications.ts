import { supabaseAdmin } from "@/lib/supabase";
import { nowStr } from "@/lib/datetime";
import { isKomunikaConfigured, sendKomunikaMessage } from "@/lib/services/komunika";
import type { Notification, NotificationType, NotificationChannelStatus } from "@/lib/types";

function fail(message: string): never {
  throw new Error(message);
}

export async function createNotification(data: {
  type: NotificationType;
  title: string;
  message: string;
  appointment_id?: number | null;
  professional_id?: string | null;
}): Promise<Notification> {
  const { data: row, error } = await supabaseAdmin
    .from("notifications")
    .insert({
      type: data.type,
      title: data.title,
      message: data.message,
      appointment_id: data.appointment_id ?? null,
      professional_id: data.professional_id ?? null,
      read: 0,
      channel_status: "pending",
      created_at: nowStr(),
    })
    .select("*")
    .single();

  if (error) fail(`[notifications] Falha ao criar notificacao: ${error.message}`);
  return row as unknown as Notification;
}

export async function listNotifications(opts?: {
  type?: NotificationType;
  unreadOnly?: boolean;
  limit?: number;
}): Promise<Notification[]> {
  let query = supabaseAdmin.from("notifications").select("*");

  if (opts?.type) query = query.eq("type", opts.type);
  if (opts?.unreadOnly) query = query.eq("read", 0);

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(opts?.limit ?? 50);

  if (error) fail(`[notifications] Falha ao listar notificacoes: ${error.message}`);
  return (data ?? []) as unknown as Notification[];
}

export async function getUnreadCount(): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("read", 0);

  if (error) fail(`[notifications] Falha ao contar notificacoes: ${error.message}`);
  return count ?? 0;
}

export async function markAsRead(id: number): Promise<void> {
  const { error } = await supabaseAdmin.from("notifications").update({ read: 1 }).eq("id", id);
  if (error) fail(`[notifications] Falha ao marcar como lida: ${error.message}`);
}

export async function markAllAsRead(): Promise<void> {
  const { error } = await supabaseAdmin.from("notifications").update({ read: 1 }).eq("read", 0);
  if (error) fail(`[notifications] Falha ao marcar todas como lidas: ${error.message}`);
}

export async function updateChannelStatus(
  id: number,
  status: NotificationChannelStatus
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("notifications")
    .update({ channel_status: status })
    .eq("id", id);

  if (error) console.error("[notifications] Falha ao atualizar o status do canal:", error.message);
}

export async function sendDoctorNotification(
  doctorPhone: string,
  notification: Notification
): Promise<void> {
  if (!doctorPhone || !isKomunikaConfigured()) {
    await updateChannelStatus(notification.id, "failed");
    return;
  }

  const text = `[SaúdeSync] ${notification.title}\n\n${notification.message}`;

  try {
    const result = await sendKomunikaMessage(doctorPhone, text, { type: "text" });
    await updateChannelStatus(notification.id, result.ok ? "sent" : "failed");
  } catch {
    await updateChannelStatus(notification.id, "failed");
  }
}

export async function notifyDoctorNewAppointment(
  professionalId: string | null,
  doctorName: string,
  doctorPhone: string,
  patientName: string,
  specialtyName: string,
  startsAt: string,
  appointmentId: number
): Promise<void> {
  const time = startsAt.split(" ")[1] ?? startsAt;
  const date = startsAt.split(" ")[0] ?? "";
  const title = "Nova consulta agendada";
  const message = `O paciente ${patientName} agendou uma consulta de ${specialtyName} para ${date} às ${time}.`;

  const notification = await createNotification({
    type: "scheduled",
    title,
    message,
    appointment_id: appointmentId,
    professional_id: professionalId,
  });

  await sendDoctorNotification(doctorPhone, notification);
}

export async function notifyDoctorCancelled(
  professionalId: string | null,
  doctorName: string,
  doctorPhone: string,
  patientName: string,
  specialtyName: string,
  startsAt: string,
  appointmentId: number
): Promise<void> {
  const time = startsAt.split(" ")[1] ?? startsAt;
  const date = startsAt.split(" ")[0] ?? "";
  const title = "Consulta cancelada";
  const message = `O paciente ${patientName} cancelou a consulta de ${specialtyName} marcada para ${date} às ${time}.`;

  const notification = await createNotification({
    type: "cancelled",
    title,
    message,
    appointment_id: appointmentId,
    professional_id: professionalId,
  });

  await sendDoctorNotification(doctorPhone, notification);
}

export async function notifyDoctorRescheduled(
  professionalId: string | null,
  doctorName: string,
  doctorPhone: string,
  patientName: string,
  specialtyName: string,
  oldStartsAt: string,
  newStartsAt: string,
  appointmentId: number
): Promise<void> {
  const oldTime = oldStartsAt.split(" ")[1] ?? oldStartsAt;
  const newTime = newStartsAt.split(" ")[1] ?? newStartsAt;
  const newDate = newStartsAt.split(" ")[0] ?? "";
  const title = "Consulta remarcada";
  const message = `O paciente ${patientName} reagendou a consulta de ${specialtyName} de ${oldTime} para ${newDate} às ${newTime}.`;

  const notification = await createNotification({
    type: "rescheduled",
    title,
    message,
    appointment_id: appointmentId,
    professional_id: professionalId,
  });

  await sendDoctorNotification(doctorPhone, notification);
}

export async function notifyDoctorReminder(
  professionalId: string | null,
  doctorName: string,
  doctorPhone: string,
  patientName: string,
  specialtyName: string,
  startsAt: string,
  appointmentId: number
): Promise<void> {
  const time = startsAt.split(" ")[1] ?? startsAt;
  const title = "Lembrete de consulta";
  const message = `Consulta de ${specialtyName} com o paciente ${patientName} daqui 30 minutos (às ${time}).`;

  const notification = await createNotification({
    type: "reminder",
    title,
    message,
    appointment_id: appointmentId,
    professional_id: professionalId,
  });

  await sendDoctorNotification(doctorPhone, notification);
}
