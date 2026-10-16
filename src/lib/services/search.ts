import { supabaseAdmin } from "@/lib/supabase";
import { displayDateTime } from "@/lib/datetime";
import {
  SEARCH_LIMIT,
  buildPatterns,
  datePatterns,
  orIlike,
  sanitizeQuery,
  SEARCH_MIN_CHARS,
} from "@/lib/search";
import type { SearchHit } from "@/lib/search";

// Busca global do dashboard: procura em paralelo nas 4 tabelas operacionais,
// sempre com clinic_id da sessão (mesmo escopo de tenant das rotas CRUD).
// Falha em qualquer tabela não derruba a busca: devolve só o que respondeu
// (a UI já trata a lista vazia).

function patientHit(row: Record<string, unknown>): SearchHit {
  const phone = String(row.phone ?? "");
  const email = String(row.email ?? "");
  return {
    id: String(row.id),
    kind: "paciente",
    title: String(row.name ?? ""),
    description: `Paciente • ${phone || email || "sem contacto"}`,
    // Ancora: a lista de pacientes marca o <tr> com id="paciente-<id>".
    href: `/pacientes?id=${String(row.id)}`,
  };
}

function professionalHit(row: Record<string, unknown>): SearchHit {
  const joined = row.specialties as { name?: string } | null | undefined;
  const specialty = String(row.specialty_name ?? "") || joined?.name || "";
  const phone = String(row.phone ?? "");
  return {
    id: String(row.id),
    kind: "medico",
    title: String(row.name ?? ""),
    description: `Profissional • ${specialty || phone || "sem especialidade"}`,
    href: `/medicos?id=${String(row.id)}`,
  };
}

function appointmentHit(row: Record<string, unknown>): SearchHit {
  const patient = String(row.patient_name ?? "");
  const id = String(row.id);
  return {
    id,
    kind: "consulta",
    title: patient,
    description: `Consulta • ${displayDateTime(String(row.starts_at ?? ""))}`,
    // #consulta-<id> faz o browser rolar até a linha na tabela de consultas.
    href: `/consultas?id=${id}#consulta-${id}`,
  };
}

function specialtyHit(row: Record<string, unknown>): SearchHit {
  const description = String(row.description ?? "").trim();
  const detail = description ? description.slice(0, 80) : "sem descrição";
  return {
    id: String(row.id),
    kind: "especialidade",
    title: String(row.name ?? ""),
    description: `Especialidade • ${detail}`,
    href: `/especialidades?id=${String(row.id)}`,
  };
}

async function searchPatients(clinicId: number, patterns: string[]): Promise<SearchHit[]> {
  const expr = orIlike(["name", "phone", "cpf", "email"], patterns);
  if (!expr) return [];

  const { data, error } = await supabaseAdmin
    .from("patients")
    .select("id, name, phone, email, cpf")
    .eq("clinic_id", clinicId)
    .or(expr)
    .order("name", { ascending: true })
    .limit(SEARCH_LIMIT);

  if (error) {
    console.error("[search] Falha ao buscar pacientes:", error.message);
    return [];
  }
  return ((data ?? []) as Record<string, unknown>[]).map(patientHit);
}

async function searchProfessionals(clinicId: number, patterns: string[]): Promise<SearchHit[]> {
  const expr = orIlike(["name", "specialty_name", "phone", "email"], patterns);
  if (!expr) return [];

  const { data, error } = await supabaseAdmin
    .from("professionals")
    .select("id, name, specialty_name, phone, email, specialties(name)")
    .eq("clinic_id", clinicId)
    .or(expr)
    .order("name", { ascending: true })
    .limit(SEARCH_LIMIT);

  if (error) {
    console.error("[search] Falha ao buscar profissionais:", error.message);
    return [];
  }
  return ((data ?? []) as Record<string, unknown>[]).map(professionalHit);
}

async function searchAppointments(clinicId: number, patterns: string[]): Promise<SearchHit[]> {
  // Nome do paciente/telefone + data: `starts_at` é ISO ("2026-10-16 09:30"),
  // por isso as variantes dd/mm entram como subcadeias (datePatterns).
  const datePats = datePatterns(patterns[0] ?? "");
  const expr = orIlike(["patient_name", "patient_phone", "starts_at"], [
    ...patterns,
    ...datePats,
  ]);
  if (!expr) return [];

  const { data, error } = await supabaseAdmin
    .from("appointments")
    .select("id, patient_name, patient_phone, starts_at, status, professionals(name)")
    .eq("clinic_id", clinicId)
    .or(expr)
    .order("starts_at", { ascending: false })
    .limit(SEARCH_LIMIT);

  if (error) {
    console.error("[search] Falha ao buscar consultas:", error.message);
    return [];
  }
  return ((data ?? []) as Record<string, unknown>[]).map(appointmentHit);
}

async function searchSpecialties(clinicId: number, patterns: string[]): Promise<SearchHit[]> {
  const expr = orIlike(["name", "description"], patterns);
  if (!expr) return [];

  const { data, error } = await supabaseAdmin
    .from("specialties")
    .select("id, name, description")
    .eq("clinic_id", clinicId)
    .or(expr)
    .order("name", { ascending: true })
    .limit(SEARCH_LIMIT);

  if (error) {
    console.error("[search] Falha ao buscar especialidades:", error.message);
    return [];
  }
  return ((data ?? []) as Record<string, unknown>[]).map(specialtyHit);
}

/** Resultados prontos para a UI, agrupados por categoria na ordem fixa. */
export async function globalSearch(
  clinicId: number,
  rawQuery: string
): Promise<SearchHit[]> {
  const query = sanitizeQuery(rawQuery);
  if (query.length < SEARCH_MIN_CHARS) return [];

  const patterns = buildPatterns(query);
  const [patients, professionals, appointments, specialties] = await Promise.all([
    searchPatients(clinicId, patterns),
    searchProfessionals(clinicId, patterns),
    searchAppointments(clinicId, patterns),
    searchSpecialties(clinicId, patterns),
  ]);

  return [...patients, ...professionals, ...appointments, ...specialties];
}
