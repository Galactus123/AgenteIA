import { supabaseAdmin } from "@/lib/supabase";
import { getDefaultClinicId } from "@/lib/services/clinics";
import type { Specialty } from "@/lib/types";

function parseKeywords(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw as string[];
  if (typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

function rowToSpecialty(row: Record<string, unknown>): Specialty {
  return {
    id: row.id as number,
    name: row.name as string,
    description: (row.description as string) ?? "",
    keywords: parseKeywords(row.keywords),
  };
}

function fail(action: string, message: string): never {
  throw new Error(`[${action}] ${message}`);
}

export async function listSpecialties(): Promise<Specialty[]> {
  const { data, error } = await supabaseAdmin
    .from("specialties")
    .select("*")
    .order("name", { ascending: true });

  if (error) fail("specialties", error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(rowToSpecialty);
}

export async function getSpecialty(id: number): Promise<Specialty | null> {
  const { data, error } = await supabaseAdmin
    .from("specialties")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) fail("specialties", error.message);
  return data ? rowToSpecialty(data as Record<string, unknown>) : null;
}

export async function createSpecialty(data: {
  name: string;
  description?: string;
  keywords?: string[];
}): Promise<Specialty> {
  const clinicId = await getDefaultClinicId();
  const { data: row, error } = await supabaseAdmin
    .from("specialties")
    .insert({
      name: data.name,
      description: data.description ?? "",
      keywords: JSON.stringify(data.keywords ?? []),
      clinic_id: clinicId,
    })
    .select("*")
    .single();

  if (error) fail("specialties", error.message);
  return rowToSpecialty(row as Record<string, unknown>);
}

export async function updateSpecialty(
  id: number,
  data: { name?: string; description?: string; keywords?: string[] }
): Promise<Specialty | null> {
  const existing = await getSpecialty(id);
  if (!existing) return null;

  const patch: Record<string, unknown> = {
    name: data.name ?? existing.name,
    description: data.description ?? existing.description,
    keywords: JSON.stringify(data.keywords ?? existing.keywords),
  };

  const { data: row, error } = await supabaseAdmin
    .from("specialties")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) fail("specialties", error.message);
  return rowToSpecialty(row as Record<string, unknown>);
}

export async function deleteSpecialty(id: number): Promise<void> {
  const { error } = await supabaseAdmin.from("specialties").delete().eq("id", id);
  if (error) fail("specialties", error.message);
}
