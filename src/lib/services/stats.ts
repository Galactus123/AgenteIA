import { supabaseAdmin } from "@/lib/supabase";
import { todayStr, addDays } from "@/lib/datetime";
import type { DoctorSchedule } from "@/lib/types";

export interface DashboardStats {
  scheduled: number;
  cancelled: number;
  rescheduled: number;
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
  pendingRequests: {
    id: number;
    patient_name: string;
    patient_phone: string;
    specialty_name: string;
    preferred_date: string;
    preferred_time: string;
    reason: string;
    source: string;
    created_at: string;
  }[];
  doctors: {
    id: string;
    name: string;
    specialty_name: string;
    status: string;
    schedule: DoctorSchedule[];
  }[];
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

  const [scheduled, cancelled, rescheduled, totalConversations, botMessages, activeDoctors, conversions] =
    await Promise.all([
      countRun(() => appointmentsCount().eq("status", "scheduled"), "appointments: status=scheduled"),
      countRun(() => appointmentsCount().eq("status", "cancelled"), "appointments: status=cancelled"),
      countRun(() => appointmentsCount().eq("rescheduled", 1), "appointments: rescheduled=1"),
      countRun(() => countQuery("conversations"), "conversations"),
      countRun(() => countQuery("messages").eq("sender", "bot"), "messages: sender=bot"),
      countRun(() => countQuery("professionals").eq("status", "active"), "professionals: status=active"),
      countRun(() => appointmentsCount().eq("source", "ia").eq("status", "scheduled"), "conversions"),
    ]);

  const totalPatients = await countDistinctPatients();
  const conversionRate =
    totalConversations > 0 ? Math.round((conversions / totalConversations) * 100) : 0;

  const todayAppointments = await loadTodayAppointments(today, tomorrow);
  const pendingRequests = await loadPendingRequests(today, tomorrow);
  const doctors = await loadDoctorStats();

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

function appointmentsCount() {
  return supabaseAdmin.from("appointments").select("id", { count: "exact", head: true });
}

function countQuery(table: "conversations" | "messages" | "professionals") {
  return supabaseAdmin.from(table).select("id", { count: "exact", head: true });
}

async function countRun(
  run: () => PromiseLike<CountResponse>,
  scope: string
): Promise<number> {
  try {
    const { count, error } = await run();
    if (error) {
      warn(scope, error.message);
      return 0;
    }
    return count ?? 0;
  } catch (err) {
    warn(scope, err instanceof Error ? err.message : String(err));
    return 0;
  }
}

async function countDistinctPatients(): Promise<number> {
  try {
    const { data, error } = await supabaseAdmin.from("appointments").select("patient_name");
    if (error) {
      warn("distinct patients", error.message);
      return 0;
    }
    return new Set((data ?? []).map((row) => row.patient_name).filter(Boolean)).size;
  } catch {
    return 0;
  }
}

async function loadTodayAppointments(
  today: string,
  tomorrow: string
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
    return [];
  }
}

async function loadPendingRequests(
  today: string,
  tomorrow: string
): Promise<DashboardStats["pendingRequests"]> {
  try {
    const { data, error } = await supabaseAdmin
      .from("appointments")
      .select(
        "id, patient_name, patient_phone, starts_at, reason, source, created_at, specialties(name)"
      )
      .eq("status", "scheduled")
      .gte("starts_at", `${today} 00:00`)
      .lt("starts_at", `${tomorrow} 00:00`)
      .order("starts_at", { ascending: true })
      .limit(5);

    if (error) {
      warn("pendingRequests", error.message);
      return [];
    }

    return (data ?? []).map((row) => ({
      id: row.id,
      patient_name: row.patient_name,
      patient_phone: row.patient_phone,
      specialty_name: (row.specialties as unknown as { name?: string } | null)?.name ?? "",
      preferred_date: String(row.starts_at ?? "").slice(0, 10),
      preferred_time: String(row.starts_at ?? "").slice(11, 16),
      reason: row.reason ?? "",
      source: row.source ?? "ia",
      created_at: row.created_at,
    }));
  } catch (err) {
    warn("pendingRequests", err instanceof Error ? err.message : String(err));
    return [];
  }
}

async function loadDoctorStats(): Promise<DashboardStats["doctors"]> {
  try {
    const { data, error } = await supabaseAdmin
      .from("professionals")
      .select("id, name, status, schedule, specialties(name)")
      .order("name", { ascending: true });

    if (error) {
      warn("doctors", error.message);
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
    return [];
  }
}
