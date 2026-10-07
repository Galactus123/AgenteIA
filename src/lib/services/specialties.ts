import { supabaseAdmin } from "@/lib/supabase";
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

// clinicId opcional só para o agente (contexto inbound sem clínica resolvida
// — Ponto 3); as rotas autenticadas passam sempre o clinic_id da sessão.
export async function listSpecialties(clinicId?: number): Promise<Specialty[]> {
  let query = supabaseAdmin.from("specialties").select("*");
  if (clinicId !== undefined) query = query.eq("clinic_id", clinicId);
  const { data, error } = await query.order("name", { ascending: true });

  if (error) fail("specialties", error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(rowToSpecialty);
}

export async function getSpecialty(id: number, clinicId?: number): Promise<Specialty | null> {
  let query = supabaseAdmin.from("specialties").select("*").eq("id", id);
  if (clinicId !== undefined) query = query.eq("clinic_id", clinicId);
  const { data, error } = await query.maybeSingle();

  if (error) fail("specialties", error.message);
  return data ? rowToSpecialty(data as Record<string, unknown>) : null;
}

export async function createSpecialty(
  clinicId: number,
  data: {
    name: string;
    description?: string;
    keywords?: string[];
  }
): Promise<Specialty> {
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
  data: { name?: string; description?: string; keywords?: string[] },
  clinicId?: number
): Promise<Specialty | null> {
  const existing = await getSpecialty(id, clinicId);
  if (!existing) return null;

  const patch: Record<string, unknown> = {
    name: data.name ?? existing.name,
    description: data.description ?? existing.description,
    keywords: JSON.stringify(data.keywords ?? existing.keywords),
  };

  let query = supabaseAdmin
    .from("specialties")
    .update(patch)
    .eq("id", id);
  if (clinicId !== undefined) query = query.eq("clinic_id", clinicId);

  const { data: row, error } = await query.select("*").single();

  if (error) fail("specialties", error.message);
  return rowToSpecialty(row as Record<string, unknown>);
}

export async function deleteSpecialty(id: number, clinicId?: number): Promise<void> {
  let query = supabaseAdmin.from("specialties").delete().eq("id", id);
  if (clinicId !== undefined) query = query.eq("clinic_id", clinicId);
  const { error } = await query;
  if (error) fail("specialties", error.message);
}
