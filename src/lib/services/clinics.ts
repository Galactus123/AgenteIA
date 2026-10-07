import { supabaseAdmin } from "@/lib/supabase";
import type { Clinic } from "@/lib/types";

// Sem clinicId devolve a primeira clínica da base — caminho legado restrito a
// contexto sem sessão (webhook/cron). Rotas autenticadas passam sempre o
// clinic_id resolvido do próprio utilizador (requireClinic).
export async function getClinic(clinicId?: number): Promise<Clinic | null> {
  const base = supabaseAdmin.from("clinics").select("*");
  const query = clinicId === undefined ? base : base.eq("id", clinicId);
  const { data, error } = await query
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[clinics] Falha ao consultar a clinica:", error.message);
    return null;
  }
  return (data) ?? null;
}

export async function updateClinic(
  clinicId: number,
  data: {
    name?: string;
    address?: string;
    phone?: string;
    whatsapp?: string;
    opening_hours?: string;
    location?: string;
    social_media?: string;
  }
): Promise<Clinic | null> {
  const clinic = await getClinic(clinicId);
  if (!clinic) return null;

  const patch = {
    name: data.name ?? clinic.name,
    address: data.address ?? clinic.address,
    phone: data.phone ?? clinic.phone,
    whatsapp: data.whatsapp ?? clinic.whatsapp,
    opening_hours: data.opening_hours ?? clinic.opening_hours,
    location: data.location ?? clinic.location,
    social_media: data.social_media ?? clinic.social_media,
  };

  const { error } = await supabaseAdmin.from("clinics").update(patch).eq("id", clinicId);
  if (error) {
    console.error("[clinics] Falha ao atualizar a clinica:", error.message);
    return null;
  }
  return getClinic(clinicId);
}
