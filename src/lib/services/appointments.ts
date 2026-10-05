import { supabaseAdmin } from "@/lib/supabase";
import type { Appointment, AppointmentView, AvailableSlot } from "@/lib/types";
import {
  addDays,
  addMinutes,
  dateFromStr,
  formatDateTime,
  nowStr,
  parseDatetime,
  todayStr,
  weekdayOf,
} from "@/lib/datetime";
import {
  notifyDoctorNewAppointment,
  notifyDoctorCancelled,
  notifyDoctorRescheduled,
} from "@/lib/services/notifications";
import { getDefaultClinicId } from "@/lib/services/clinics";
import { getDoctorSchedule, normalizeSchedule } from "@/lib/services/doctors";
import type { DoctorSchedule } from "@/lib/types";

const CANCEL_WINDOW_HOURS = 4;
const MAX_RESCHEDULES = 1;

// No-show (Fase 3.6): a partir de quantos minutos do inicio a consulta
// deixa de valer como "scheduled" e passa a liberar a agenda.
export const NO_SHOW_GRACE_MINUTES = 30;

// Concorrencia de horario (Fase 3.3): o indice unico
// uq_appointments_professional_start e a ultima barreira quando duas
// requisicoes passam juntas pela verificacao de conflito. Em vez do
// erro cruo do banco, o fluxo (API e agente) recebe um erro tipado e
// amigavel para devolver "horario acabou de ser ocupado".
export class SlotTakenError extends Error {
  readonly code = "SLOT_TAKEN";

  constructor(message = "Este horário acabou de ser ocupado. Escolha outro horário.") {
    super(message);
    this.name = "SlotTakenError";
  }
}

function isUniqueViolation(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "23505" || (error.message ?? "").includes("duplicate key value");
}

// Horario de funcionamento (Fase 3.6): o agendamento/remarcacao fora da
// agenda cadastrada do profissional — tipicamente no agendamento do mesmo
// dia, em que o LLM pode sugerir um horario que a listagem nunca mostrou.
export class OutsideHoursError extends Error {
  readonly code = "OUTSIDE_HOURS";

  constructor(message = "Este horário está fora do horário de funcionamento do profissional.") {
    super(message);
    this.name = "OutsideHoursError";
  }
}

// Regra pura: o intervalo [startsAt, endsAt] cabe em alguma janela de
// trabalho do dia? Agenda vazia = sem restrição cadastrada (valida nada).
export function checkWithinWorkingHours(
  schedule: DoctorSchedule[],
  startsAt: Date,
  endsAt: Date
): { ok: boolean; reason?: string } {
  const weekday = startsAt.getDay();
  const windows = schedule.filter((entry) => entry.weekday === weekday);
  if (windows.length === 0) {
    return {
      ok: false,
      reason: "O profissional não atende neste dia da semana.",
    };
  }

  const startStr = `${pad2(startsAt.getHours())}:${pad2(startsAt.getMinutes())}`;
  const endStr = `${pad2(endsAt.getHours())}:${pad2(endsAt.getMinutes())}`;

  const fits = windows.find((w) => w.start_time <= startStr && endStr <= w.end_time);
  if (fits) return { ok: true };

  const label = windows.map((w) => `${w.start_time}-${w.end_time}`).join(" ou ");
  return {
    ok: false,
    reason: `Este horário está fora do expediente do profissional (atende ${label}).`,
  };
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

// Embedding via FK: specialties(name), professionals(...), clinics(name, address).
const VIEW_SELECT =
  "*, specialties(name), professionals(name, consultation_duration, price), clinics(name, address)";

interface AppointmentRow extends Record<string, unknown> {
  specialties: { name?: string } | null;
  professionals: { name?: string; consultation_duration?: number; price?: number } | null;
  clinics: { name?: string; address?: string } | null;
}

function toView(row: AppointmentRow): AppointmentView {
  const base: Record<string, unknown> = { ...row };
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

function fail(message: string): never {
  throw new Error(message);
}

async function resolveViews(response: {
  data: unknown;
  error: { message: string } | null;
}): Promise<AppointmentView[]> {
  if (response.error) fail(`[appointments] Falha ao consultar consultas: ${response.error.message}`);
  return ((response.data ?? []) as unknown as AppointmentRow[]).map(toView);
}

export async function listAppointments(): Promise<AppointmentView[]> {
  const query = supabaseAdmin
    .from("appointments")
    .select(VIEW_SELECT)
    .order("starts_at", { ascending: false });
  return resolveViews(await query);
}

export async function listAppointmentsFiltered(opts: {
  date?: string;
  status?: string;
}): Promise<AppointmentView[]> {
  let query = supabaseAdmin.from("appointments").select(VIEW_SELECT);

  if (opts.date) {
    query = query
      .gte("starts_at", `${opts.date} 00:00`)
      .lt("starts_at", `${addDays(opts.date, 1)} 00:00`);
  }
  if (opts.status) query = query.eq("status", opts.status);

  return resolveViews(await query.order("starts_at", { ascending: false }));
}

export async function listAppointmentsByDate(dateStr: string): Promise<AppointmentView[]> {
  const query = supabaseAdmin
    .from("appointments")
    .select(VIEW_SELECT)
    .gte("starts_at", `${dateStr} 00:00`)
    .lt("starts_at", `${addDays(dateStr, 1)} 00:00`)
    .order("starts_at", { ascending: true });

  return resolveViews(await query);
}

export async function upcomingAppointments(): Promise<AppointmentView[]> {
  const query = supabaseAdmin
    .from("appointments")
    .select(VIEW_SELECT)
    .eq("status", "scheduled")
    .gte("starts_at", `${todayStr()} 00:00`)
    .order("starts_at", { ascending: true });

  return resolveViews(await query);
}

export async function getAppointment(id: number): Promise<Appointment | null> {
  const { data, error } = await supabaseAdmin
    .from("appointments")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) fail(`[appointments] Falha ao consultar a consulta: ${error.message}`);
  return (data) ?? null;
}

export async function getAppointmentView(id: number): Promise<AppointmentView | null> {
  const query = supabaseAdmin
    .from("appointments")
    .select(VIEW_SELECT)
    .eq("id", id)
    .limit(1);
  const views = await resolveViews(await query);
  return views[0] ?? null;
}

export async function getAppointmentByConversation(
  conversationId: number
): Promise<AppointmentView | null> {
  const query = supabaseAdmin
    .from("appointments")
    .select(VIEW_SELECT)
    .eq("conversation_id", conversationId)
    .eq("status", "scheduled")
    .order("starts_at", { ascending: false })
    .limit(1);
  const views = await resolveViews(await query);
  return views[0] ?? null;
}

export async function findUpcomingAppointmentByPhone(phone: string): Promise<AppointmentView | null> {
  const query = supabaseAdmin
    .from("appointments")
    .select(VIEW_SELECT)
    .eq("patient_phone", phone)
    .eq("status", "scheduled")
    .order("starts_at", { ascending: true })
    .limit(1);
  const views = await resolveViews(await query);
  return views[0] ?? null;
}

async function getProfessionalDuration(professionalId: string): Promise<number | null> {
  const { data, error } = await supabaseAdmin
    .from("professionals")
    .select("consultation_duration")
    .eq("id", professionalId)
    .maybeSingle();

  if (error) fail(`[appointments] Falha ao consultar o profissional: ${error.message}`);
  return data ? ((data as { consultation_duration?: number }).consultation_duration ?? 30) : null;
}

// Guarda de agendamento (Fase 3.6): horario no passado ou fora da agenda
// cadastrada do profissional. Agenda vazia = profissional sem expediente
// configurado (nao ha o que validar — comportamento manual preservado).
async function assertWithinWorkingHours(
  professionalId: string,
  startsAt: Date,
  endsAt: Date
): Promise<void> {
  if (startsAt.getTime() <= Date.now()) {
    throw new OutsideHoursError("Este horário já passou. Escolha um horário futuro.");
  }

  const schedule = await getDoctorSchedule(professionalId);
  if (schedule.length === 0) return;

  const check = checkWithinWorkingHours(schedule, startsAt, endsAt);
  if (!check.ok) throw new OutsideHoursError(check.reason);
}

async function hasConflict(
  professionalId: string,
  startsAt: Date,
  durationMinutes: number,
  excludeId?: number
): Promise<boolean> {
  const endStr = formatDateTime(addMinutes(startsAt, durationMinutes));
  const startStr = formatDateTime(startsAt);

  let query = supabaseAdmin
    .from("appointments")
    .select("id")
    .eq("professional_id", professionalId)
    .eq("status", "scheduled")
    .lt("starts_at", endStr)
    .gt("ends_at", startStr);

  if (excludeId !== undefined) query = query.neq("id", excludeId);

  const { data, error } = await query.limit(1);
  if (error) fail(`[appointments] Falha ao verificar disponibilidade: ${error.message}`);
  return (data?.length ?? 0) > 0;
}

export async function isSlotAvailable(professionalId: string, startsAtStr: string): Promise<boolean> {
  const duration = await getProfessionalDuration(professionalId);
  if (duration === null) return false;
  return !(await hasConflict(professionalId, parseDatetime(startsAtStr), duration));
}

interface BusyWindow {
  professional_id: string | null;
  start: number;
  end: number;
}

export interface SlotEnumerationInput {
  specialtyId: number;
  specialtyName: string;
  professionalId: string;
  doctorName: string;
  price: number;
  schedule: DoctorSchedule[];
  durationMinutes: number;
  weekday: number;
  dayStart: Date;
  minStart: Date;
  busy: BusyWindow[];
}

// Enumera os slots livres de um profissional num dia (regra pura).
// Fase 3.6: o passo entre slots e a duracao da consulta
// (consultation_duration do profissional), nunca um fixo de 30 min —
// com agenda de 60 min os slots sao 08:00, 09:00... e nao 08:00, 08:30.
export function enumerateSlots(input: SlotEnumerationInput): AvailableSlot[] {
  const { durationMinutes, weekday, dayStart, minStart, busy, schedule } = input;
  const slots: AvailableSlot[] = [];

  for (const entry of schedule) {
    if (entry.weekday !== weekday) continue;

    const [sh, sm] = entry.start_time.split(":").map(Number);
    const [eh, em] = entry.end_time.split(":").map(Number);
    if (!Number.isFinite(sh) || !Number.isFinite(eh)) continue;

    const start = new Date(
      dayStart.getFullYear(),
      dayStart.getMonth(),
      dayStart.getDate(),
      sh,
      sm || 0
    );
    const end = new Date(
      dayStart.getFullYear(),
      dayStart.getMonth(),
      dayStart.getDate(),
      eh,
      em || 0
    );

    let cursor = start;
    while (addMinutes(cursor, durationMinutes).getTime() <= end.getTime()) {
      const slotStart = new Date(cursor);
      const slotEnd = addMinutes(slotStart, durationMinutes);
      const free = !busy.some((w) => w.start < slotEnd.getTime() && w.end > slotStart.getTime());

      if (slotStart.getTime() >= minStart.getTime() && free) {
        slots.push({
          professional_id: input.professionalId,
          doctor_name: input.doctorName,
          specialty_id: input.specialtyId,
          specialty_name: input.specialtyName,
          starts_at: formatDateTime(slotStart),
          ends_at: formatDateTime(slotEnd),
          price: input.price,
        });
      }
      cursor = addMinutes(cursor, durationMinutes);
    }
  }

  return slots;
}

export async function getAvailableSlots(
  specialtyId: number,
  dateStr: string
): Promise<AvailableSlot[]> {
  const weekday = weekdayOf(dateStr);
  const dayStart = dateFromStr(dateStr);
  const nextDayStr = addDays(dateStr, 1);
  const now = new Date();
  const minStart = addMinutes(now, 2 * 60);

  const [{ data: professionals, error: profError }, { data: specialty, error: specError }, busy] =
    await Promise.all([
      supabaseAdmin
        .from("professionals")
        .select("id, name, consultation_duration, price, schedule")
        .eq("specialty_id", specialtyId)
        .eq("status", "active")
        .order("name", { ascending: true }),
      supabaseAdmin.from("specialties").select("name").eq("id", specialtyId).maybeSingle(),
      loadBusyWindows(dateStr, nextDayStr),
    ]);

  if (profError) fail(`[appointments] Falha ao consultar profissionais: ${profError.message}`);
  if (specError) fail(`[appointments] Falha ao consultar a especialidade: ${specError.message}`);

  const specialtyName = (specialty as { name?: string } | null)?.name ?? "";
  const slots: AvailableSlot[] = [];

  for (const professional of (professionals ?? []) as Record<string, unknown>[]) {
    const professionalId = professional.id as string;
    slots.push(
      ...enumerateSlots({
        specialtyId,
        specialtyName,
        professionalId,
        doctorName: professional.name as string,
        price: Number(professional.price ?? 0),
        schedule: normalizeSchedule(professional.schedule),
        durationMinutes: Number(professional.consultation_duration ?? 30),
        weekday,
        dayStart,
        minStart,
        busy: busy.filter((w) => w.professional_id === professionalId),
      })
    );
  }

  return slots.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}

// Carrega de uma so vez todas as janelas ocupadas do dia (evita N+1 por slot).
async function loadBusyWindows(fromDate: string, toDate: string): Promise<BusyWindow[]> {
  const { data, error } = await supabaseAdmin
    .from("appointments")
    .select("professional_id, starts_at, ends_at")
    .eq("status", "scheduled")
    .lt("starts_at", `${toDate} 00:00`)
    .gt("ends_at", `${fromDate} 00:00`);

  if (error) fail(`[appointments] Falha ao consultar a agenda: ${error.message}`);

  return ((data ?? []) as { professional_id: string | null; starts_at: string; ends_at: string }[])
    .map((row) => ({
      professional_id: row.professional_id,
      start: parseDatetime(row.starts_at).getTime(),
      end: parseDatetime(row.ends_at).getTime(),
    }))
    .filter((w) => Number.isFinite(w.start) && Number.isFinite(w.end));
}

export async function getSpecialtyNames(): Promise<Record<number, string>> {
  const { data, error } = await supabaseAdmin.from("specialties").select("id, name");
  if (error) fail(`[appointments] Falha ao consultar especialidades: ${error.message}`);

  const map: Record<number, string> = {};
  for (const row of (data ?? []) as { id: number; name: string }[]) map[row.id] = row.name;
  return map;
}

export async function createAppointment(data: {
  patient_name: string;
  patient_phone: string;
  specialty_id: number;
  professional_id: string;
  starts_at: string;
  reason?: string;
  source?: string;
  conversation_id?: number | null;
}): Promise<AppointmentView> {
  const duration = await getProfessionalDuration(data.professional_id);
  if (duration === null) fail("Profissional não encontrado.");

  const startsAt = parseDatetime(data.starts_at);
  const endsAt = addMinutes(startsAt, duration);
  await assertWithinWorkingHours(data.professional_id, startsAt, endsAt);
  const clinicId = await getDefaultClinicId();
  const now = nowStr();

  const { data: row, error } = await supabaseAdmin
    .from("appointments")
    .insert({
      patient_name: data.patient_name,
      patient_phone: data.patient_phone,
      specialty_id: data.specialty_id,
      professional_id: data.professional_id,
      starts_at: data.starts_at,
      ends_at: formatDateTime(endsAt),
      status: "scheduled",
      reason: data.reason ?? "",
      source: data.source ?? "ia",
      conversation_id: data.conversation_id ?? null,
      clinic_id: clinicId,
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single();

  if (error) {
    if (isUniqueViolation(error)) throw new SlotTakenError();
    fail(`[appointments] Falha ao criar a consulta: ${error.message}`);
  }

  const view = await getAppointmentView((row).id);
  if (!view) fail("Consulta criada mas não encontrada.");

  await triggerNewAppointmentNotification(view);
  return view;
}

async function getDoctorPhone(professionalId: string | null): Promise<string> {
  if (!professionalId) return "";
  const { data } = await supabaseAdmin
    .from("professionals")
    .select("phone")
    .eq("id", professionalId)
    .maybeSingle();
  return (data as { phone?: string } | null)?.phone ?? "";
}

async function triggerNewAppointmentNotification(appointment: AppointmentView): Promise<void> {
  try {
    const phone = await getDoctorPhone(appointment.professional_id);
    if (phone) {
      await notifyDoctorNewAppointment(
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
    console.error("[appointments] Falha ao notificar o profissional:", err);
  }
}

// Regra de janela (Fase 3.6): dentro da janela de 4h ou ja remarcada
// 1x, so a recepcao humana pode agir — o agente deve transferir.
export interface RuleCheck {
  ok: boolean;
  reason?: string;
  requiresHuman?: boolean;
}

export function canCancel(appointment: Appointment): RuleCheck {
  if (appointment.status !== "scheduled") {
    return { ok: false, reason: "Esta consulta já não está ativa." };
  }
  const startsAt = parseDatetime(appointment.starts_at);
  const hours = (startsAt.getTime() - Date.now()) / 3600000;
  if (hours < CANCEL_WINDOW_HOURS) {
    return {
      ok: false,
      requiresHuman: true,
      reason: "O cancelamento deve ser feito com pelo menos 4 horas de antecedência. Contacte a recepção.",
    };
  }
  return { ok: true };
}

export async function cancelAppointment(id: number): Promise<AppointmentView> {
  const appointment = await getAppointment(id);
  if (!appointment) fail("Consulta não encontrada.");

  const check = canCancel(appointment);
  if (!check.ok) fail(check.reason ?? "Operação não permitida.");

  const now = nowStr();
  const { error } = await supabaseAdmin
    .from("appointments")
    .update({ status: "cancelled", cancelled_at: now, updated_at: now })
    .eq("id", id);

  if (error) fail(`[appointments] Falha ao cancelar: ${error.message}`);

  const view = await getAppointmentView(id);
  if (!view) fail("Consulta não encontrada.");

  try {
    const phone = await getDoctorPhone(view.professional_id);
    if (phone) {
      await notifyDoctorCancelled(
        view.professional_id,
        view.doctor_name,
        phone,
        view.patient_name,
        view.specialty_name,
        view.starts_at,
        view.id
      );
    }
  } catch (err) {
    console.error("[appointments] Falha ao notificar o profissional:", err);
  }

  return view;
}

// ── No-show (Fase 3.6) ────────────────────────────────────────
// A consulta que comecou ha mais de NO_SHOW_GRACE_MINUTES deixa de ser
// "scheduled": a agenda (busy windows, conflitos e listagens) ja conta
// apenas status=scheduled, entao marcar no_show LIBERA o horario.

export function isNoShowDue(
  startsAtStr: string,
  now: Date = new Date(),
  graceMinutes: number = NO_SHOW_GRACE_MINUTES
): boolean {
  const startsAt = parseDatetime(startsAtStr);
  if (!Number.isFinite(startsAt.getTime())) return false;
  return startsAt.getTime() + graceMinutes * 60_000 < now.getTime();
}

// Marcacao manual (recepcao via API/PATCH).
export async function markNoShow(id: number): Promise<AppointmentView> {
  const appointment = await getAppointment(id);
  if (!appointment) fail("Consulta não encontrada.");
  if (appointment.status !== "scheduled") {
    fail("Esta consulta já não está ativa.");
  }

  const now = nowStr();
  const { error } = await supabaseAdmin
    .from("appointments")
    .update({ status: "no_show", updated_at: now })
    .eq("id", id)
    .eq("status", "scheduled");

  if (error) fail(`[appointments] Falha ao registrar no-show: ${error.message}`);

  const view = await getAppointmentView(id);
  if (!view) fail("Consulta não encontrada.");
  return view;
}

// Varredura automatica (cron de 5 min): devolve a contagem convertida.
export async function releaseNoShowAppointments(now: Date = new Date()): Promise<number> {
  const cutoff = formatDateTime(addMinutes(now, -NO_SHOW_GRACE_MINUTES));
  const { data, error } = await supabaseAdmin
    .from("appointments")
    .update({ status: "no_show", updated_at: formatDateTime(now) })
    .eq("status", "scheduled")
    .lt("starts_at", cutoff)
    .select("id");

  if (error) {
    console.error("[appointments] Falha ao liberar no-shows:", error.message);
    return 0;
  }
  return data?.length ?? 0;
}

export function canReschedule(appointment: Appointment): RuleCheck {
  if (appointment.status !== "scheduled") {
    return { ok: false, reason: "Esta consulta já não está ativa." };
  }
  if (appointment.reschedule_count >= MAX_RESCHEDULES) {
    return {
      ok: false,
      requiresHuman: true,
      reason: "Esta consulta já foi remarcada uma vez. Contacte a recepção para novos ajustes.",
    };
  }
  const startsAt = parseDatetime(appointment.starts_at);
  const hours = (startsAt.getTime() - Date.now()) / 3600000;
  if (hours < CANCEL_WINDOW_HOURS) {
    return {
      ok: false,
      requiresHuman: true,
      reason: "A remarcação deve ser feita com pelo menos 4 horas de antecedência. Contacte a recepção.",
    };
  }
  return { ok: true };
}

export async function rescheduleAppointment(
  id: number,
  newStartsAt: string
): Promise<AppointmentView> {
  const appointment = await getAppointment(id);
  if (!appointment) fail("Consulta não encontrada.");

  const check = canReschedule(appointment);
  if (!check.ok) fail(check.reason ?? "Operação não permitida.");

  const duration = await getProfessionalDuration(
    appointment.professional_id ?? ""
  );
  if (duration === null || !appointment.professional_id) {
    fail("Profissional da consulta não encontrado.");
  }

  const startsAt = parseDatetime(newStartsAt);
  const endsAt = addMinutes(startsAt, duration);

  await assertWithinWorkingHours(appointment.professional_id, startsAt, endsAt);

  if (await hasConflict(appointment.professional_id, startsAt, duration, id)) {
    throw new SlotTakenError("Este horário já não está disponível. Escolha outro horário.");
  }

  const { error } = await supabaseAdmin
    .from("appointments")
    .update({
      starts_at: newStartsAt,
      ends_at: formatDateTime(endsAt),
      rescheduled: 1,
      reschedule_count: appointment.reschedule_count + 1,
      updated_at: nowStr(),
    })
    .eq("id", id);

  if (error) {
    if (isUniqueViolation(error)) throw new SlotTakenError();
    fail(`[appointments] Falha ao remarcar: ${error.message}`);
  }

  const view = await getAppointmentView(id);
  if (!view) fail("Consulta não encontrada.");

  try {
    const phone = await getDoctorPhone(view.professional_id);
    if (phone) {
      await notifyDoctorRescheduled(
        view.professional_id,
        view.doctor_name,
        phone,
        view.patient_name,
        view.specialty_name,
        appointment.starts_at,
        newStartsAt,
        view.id
      );
    }
  } catch (err) {
    console.error("[appointments] Falha ao notificar o profissional:", err);
  }

  return view;
}
