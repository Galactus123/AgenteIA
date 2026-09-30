import { supabaseAdmin } from "@/lib/supabase";
import { getDefaultClinicId } from "@/lib/services/clinics";
import type { Doctor, DoctorSchedule } from "@/lib/types";

export interface DoctorView extends Doctor {
  specialty_name: string;
  schedule: DoctorSchedule[];
}

export type ScheduleInput = { weekday: number; start_time: string; end_time: string }[];

const DAY_BY_LABEL: Record<string, number> = {
  dom: 0,
  seg: 1,
  ter: 2,
  qua: 3,
  qui: 4,
  sex: 5,
  sab: 6,
  sáb: 6,
};

export function normalizeSchedule(raw: unknown): DoctorSchedule[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item): DoctorSchedule | null => {
      if (typeof item === "string") {
        // Compatibilidade com o formato antigo (rotulos de dia).
        const weekday = DAY_BY_LABEL[item.trim().toLowerCase().slice(0, 3)];
        if (weekday === undefined) return null;
        return { weekday, start_time: "08:00", end_time: "17:00" };
      }
      if (!item || typeof item !== "object") return null;
      const o = item as Record<string, unknown>;
      const weekday = Number(o.weekday);
      if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return null;
      return {
        weekday,
        start_time: typeof o.start_time === "string" && o.start_time ? o.start_time : "08:00",
        end_time: typeof o.end_time === "string" && o.end_time ? o.end_time : "17:00",
      };
    })
    .filter((row): row is DoctorSchedule => row !== null)
    .sort((a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time));
}

function rowToDoctor(row: Record<string, unknown>, specialtyName = ""): DoctorView {
  const specialty = row.specialties as { name?: string } | null | undefined;
  return {
    id: row.id as string,
    name: row.name as string,
    specialty_id: (row.specialty_id as number | null) ?? null,
    consultation_duration: (row.consultation_duration as number) ?? 30,
    price: Number(row.price ?? 0),
    status: (row.status as string) ?? "active",
    phone: (row.phone as string) ?? "",
    specialty_name: specialty?.name ?? specialtyName,
    schedule: normalizeSchedule(row.schedule),
  };
}

export async function listDoctors(): Promise<DoctorView[]> {
  const { data, error } = await supabaseAdmin
    .from("professionals")
    .select("*, specialties(name)")
    .order("name", { ascending: true });

  if (error) {
    console.error("[doctors] Falha ao listar profissionais:", error.message);
    return [];
  }
  return ((data ?? []) as Record<string, unknown>[]).map((row) => rowToDoctor(row));
}

export async function getDoctor(id: string): Promise<Doctor | null> {
  const { data, error } = await supabaseAdmin
    .from("professionals")
    .select("*, specialties(name)")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[doctors] Falha ao buscar profissional:", error.message);
    return null;
  }
  return data ? rowToDoctor(data as Record<string, unknown>) : null;
}

export async function getDoctorSchedule(doctorId: string): Promise<DoctorSchedule[]> {
  const { data, error } = await supabaseAdmin
    .from("professionals")
    .select("schedule")
    .eq("id", doctorId)
    .maybeSingle();

  if (error || !data) return [];
  return normalizeSchedule((data as { schedule?: unknown }).schedule);
}

export async function getActiveDoctorsBySpecialty(specialtyId: number): Promise<Doctor[]> {
  const { data, error } = await supabaseAdmin
    .from("professionals")
    .select("*")
    .eq("specialty_id", specialtyId)
    .eq("status", "active")
    .order("name", { ascending: true });

  if (error) {
    console.error("[doctors] Falha ao listar profissionais da especialidade:", error.message);
    return [];
  }
  return ((data ?? []) as Record<string, unknown>[]).map((row) => rowToDoctor(row));
}

export async function createDoctor(data: {
  name: string;
  specialty_id: number;
  consultation_duration?: number;
  price?: number;
  status?: string;
  phone?: string;
  schedule: ScheduleInput;
}): Promise<DoctorView> {
  const clinicId = await getDefaultClinicId();
  const { data: row, error } = await supabaseAdmin
    .from("professionals")
    .insert({
      name: data.name,
      clinic_id: clinicId,
      specialty_id: data.specialty_id,
      consultation_duration: data.consultation_duration ?? 30,
      price: data.price ?? 0,
      status: data.status ?? "active",
      phone: data.phone ?? "",
      schedule: data.schedule,
    })
    .select("*, specialties(name)")
    .single();

  if (error) throw new Error(`[doctors] Falha ao criar profissional: ${error.message}`);
  return rowToDoctor(row as Record<string, unknown>);
}

export async function updateDoctor(
  id: string,
  data: {
    name?: string;
    specialty_id?: number;
    consultation_duration?: number;
    price?: number;
    status?: string;
    phone?: string;
    schedule?: ScheduleInput;
  }
): Promise<DoctorView | null> {
  const existing = await getDoctor(id);
  if (!existing) return null;

  const patch: Record<string, unknown> = {};
  if (data.name !== undefined) patch.name = data.name;
  if (data.specialty_id !== undefined) patch.specialty_id = data.specialty_id;
  if (data.consultation_duration !== undefined) patch.consultation_duration = data.consultation_duration;
  if (data.price !== undefined) patch.price = data.price;
  if (data.status !== undefined) patch.status = data.status;
  if (data.phone !== undefined) patch.phone = data.phone;
  if (data.schedule !== undefined) patch.schedule = data.schedule;

  const { data: row, error } = await supabaseAdmin
    .from("professionals")
    .update(patch)
    .eq("id", id)
    .select("*, specialties(name)")
    .single();

  if (error) throw new Error(`[doctors] Falha ao atualizar profissional: ${error.message}`);
  return rowToDoctor(row as Record<string, unknown>);
}

export async function deleteDoctor(id: string): Promise<void> {
  const { error } = await supabaseAdmin.from("professionals").delete().eq("id", id);
  if (error) throw new Error(`[doctors] Falha ao excluir profissional: ${error.message}`);
}
