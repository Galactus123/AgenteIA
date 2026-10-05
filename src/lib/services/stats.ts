import { supabaseAdmin } from "@/lib/supabase";
import { todayStr, addDays } from "@/lib/datetime";
import type { DoctorSchedule } from "@/lib/types";

export interface PendingRequest {
  id: number;
  patient_name: string;
  patient_phone: string;
  status: string;
  updated_at: string;
}

export interface DashboardStats {
  scheduled: number;
  cancelled: number;
  rescheduled: number;
  todayScheduled: number;
  todayCancelled: number;
  todayRescheduled: number;
  totalConversations: number;
  botMessages: number;
  conversionRate: number;
  activeDoctors: number;
  totalPatients: number;
  todayAppointments: {
    id: number;
    patient_name: string;
    doctor_name: string;
    specialty_name: string;
    starts_at: string;
    status: string;
  }[];
  pendingRequests: PendingRequest[];
  doctors: {
    id: string;
    name: string;
    specialty_name: string;
    status: string;
    schedule: DoctorSchedule[];
  }[];
  errors: string[];
}

function warn(scope: string, message: string): void {
  console.warn(`[stats] ${scope}: ${message}`);
}

type CountResponse = { count: number | null; error: { message: string } | null };

function parseSchedule(value: unknown): DoctorSchedule[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (row): row is DoctorSchedule =>
      !!row && typeof row === "object" && "weekday" in (row as object)
  );
}

export async function getStats(): Promise<DashboardStats> {
  const today = todayStr();
  const tomorrow = addDays(today, 1);
  const errors: string[] = [];

  const [
    scheduled,
    cancelled,
    rescheduled,
    todayScheduled,
    todayCancelled,
    todayRescheduled,
    totalConversations,
    botMessages,
    activeDoctors,
    conversions,
    totalPatients,
  ] = await Promise.all([
    countRun(() => appointmentsCount().eq("status", "scheduled"), "appointments: status=scheduled", "consultas marcadas", errors),
    countRun(() => appointmentsCount().eq("status", "cancelled"), "appointments: status=cancelled", "consultas canceladas", errors),
    countRun(() => appointmentsCount().eq("rescheduled", 1), "appointments: rescheduled=1", "consultas remarcadas", errors),
    countRun(() => todayAppointmentsCount(today, tomorrow).eq("status", "scheduled"), "appointments: hoje status=scheduled", "consultas de hoje", errors),
    countRun(() => todayAppointmentsCount(today, tomorrow).eq("status", "cancelled"), "appointments: hoje status=cancelled", "cancelamentos de hoje", errors),
    countRun(() => todayAppointmentsCount(today, tomorrow).eq("rescheduled", 1), "appointments: hoje rescheduled=1", "remarcacoes de hoje", errors),
    countRun(() => countQuery("conversations"), "conversations", "conversas", errors),
    countRun(() => countQuery("messages").eq("sender", "bot"), "messages: sender=bot", "mensagens da IA", errors),
    countRun(() => countQuery("professionals").eq("status", "active"), "professionals: status=active", "profissionais", errors),
    countRun(() => appointmentsCount().eq("source", "ia").eq("status", "scheduled"), "conversions", "conversoes", errors),
    countRun(() => countQuery("patients"), "patients", "pacientes", errors),
  ]);

  const conversionRate =
    totalConversations > 0 ? Math.round((conversions / totalConversations) * 100) : 0;

  const todayAppointments = await loadTodayAppointments(today, tomorrow, errors);
  const pendingRequests = await loadPendingRequests(errors);
  const doctors = await loadDoctorStats(errors);

  return {
    scheduled,
    cancelled,
    rescheduled,
    todayScheduled,
    todayCancelled,
    todayRescheduled,
    totalConversations,
    botMessages,
    conversionRate,
    activeDoctors,
    totalPatients,
    todayAppointments,
    pendingRequests,
    doctors,
    errors: Array.from(new Set(errors)),
  };
}

function appointmentsCount() {
  return supabaseAdmin.from("appointments").select("id", { count: "exact", head: true });
}

function todayAppointmentsCount(today: string, tomorrow: string) {
  return appointmentsCount().gte("starts_at", `${today} 00:00`).lt("starts_at", `${tomorrow} 00:00`);
}

function countQuery(table: "conversations" | "messages" | "professionals" | "patients") {
  return supabaseAdmin.from(table).select("id", { count: "exact", head: true });
}

async function countRun(
  run: () => PromiseLike<CountResponse>,
  scope: string,
  label: string,
  errors: string[]
): Promise<number> {
  try {
    const { count, error } = await run();
    if (error) {
      warn(scope, error.message);
      errors.push(label);
      return 0;
    }
    return count ?? 0;
  } catch (err) {
    warn(scope, err instanceof Error ? err.message : String(err));
    errors.push(label);
    return 0;
  }
}

async function loadTodayAppointments(
  today: string,
  tomorrow: string,
  errors: string[]
): Promise<DashboardStats["todayAppointments"]> {
  try {
    const { data, error } = await supabaseAdmin
      .from("appointments")
      .select("id, patient_name, starts_at, status, professionals!inner(name), specialties!inner(name)")
      .gte("starts_at", `${today} 00:00`)
      .lt("starts_at", `${tomorrow} 00:00`)
      .order("starts_at", { ascending: true });

    if (error) {
      warn("todayAppointments", error.message);
      errors.push("agenda de hoje");
      return [];
    }

    return (data ?? []).map((row) => ({
      id: row.id,
      patient_name: row.patient_name,
      doctor_name: (row.professionals as unknown as { name?: string } | null)?.name ?? "",
      specialty_name: (row.specialties as unknown as { name?: string } | null)?.name ?? "",
      starts_at: row.starts_at,
      status: row.status,
    }));
  } catch (err) {
    warn("todayAppointments", err instanceof Error ? err.message : String(err));
    errors.push("agenda de hoje");
    return [];
  }
}

const HUMAN_WAITING_STATUSES = ["transferred", "WAITING_HUMAN_INTERVENTION"];

async function loadPendingRequests(
  errors: string[]
): Promise<DashboardStats["pendingRequests"]> {
  try {
    const { data, error } = await supabaseAdmin
      .from("conversations")
      .select("id, phone, patient_name, status, updated_at")
      .in("status", HUMAN_WAITING_STATUSES)
      .order("updated_at", { ascending: false })
      .limit(5);

    if (error) {
      warn("pendingRequests", error.message);
      errors.push("conversas aguardando humano");
      return [];
    }

    return (data ?? []).map((row) => ({
      id: row.id,
      patient_name: row.patient_name ?? "",
      patient_phone: row.phone ?? "",
      status: row.status,
      updated_at: row.updated_at,
    }));
  } catch (err) {
    warn("pendingRequests", err instanceof Error ? err.message : String(err));
    errors.push("conversas aguardando humano");
    return [];
  }
}

async function loadDoctorStats(errors: string[]): Promise<DashboardStats["doctors"]> {
  try {
    const { data, error } = await supabaseAdmin
      .from("professionals")
      .select("id, name, status, schedule, specialties(name)")
      .order("name", { ascending: true });

    if (error) {
      warn("doctors", error.message);
      errors.push("medicos");
      return [];
    }

    return (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      specialty_name: (row.specialties as unknown as { name?: string } | null)?.name ?? "",
      status: row.status,
      schedule: parseSchedule(row.schedule),
    }));
  } catch (err) {
    warn("doctors", err instanceof Error ? err.message : String(err));
    errors.push("medicos");
    return [];
  }
}
