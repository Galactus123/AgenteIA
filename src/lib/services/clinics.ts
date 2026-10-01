import { supabaseAdmin } from "@/lib/supabase";
import type { Clinic } from "@/lib/types";

export async function getClinic(): Promise<Clinic | null> {
  const { data, error } = await supabaseAdmin
    .from("clinics")
    .select("*")
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[clinics] Falha ao consultar a clinica:", error.message);
    return null;
  }
  return (data) ?? null;
}

export async function getDefaultClinicId(): Promise<number> {
  const clinic = await getClinic();
  return clinic?.id ?? 1;
}

export async function updateClinic(data: {
  name?: string;
  address?: string;
  phone?: string;
  whatsapp?: string;
  opening_hours?: string;
  location?: string;
  social_media?: string;
}): Promise<Clinic | null> {
  const clinic = await getClinic();
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

  const { error } = await supabaseAdmin.from("clinics").update(patch).eq("id", clinic.id);
  if (error) {
    console.error("[clinics] Falha ao atualizar a clinica:", error.message);
    return null;
  }
  return getClinic();
}
