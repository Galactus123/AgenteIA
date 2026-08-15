import { db } from "@/lib/db";
import type { Clinic } from "@/lib/types";

export function getClinic(): Clinic | null {
  return (db.prepare("SELECT * FROM clinics LIMIT 1").get() as unknown as Clinic | undefined) ?? null;
}

export function updateClinic(data: {
  name?: string;
  address?: string;
  phone?: string;
  whatsapp?: string;
  opening_hours?: string;
  location?: string;
  social_media?: string;
}): Clinic | null {
  const clinic = getClinic();
  if (!clinic) return null;
  db.prepare(
    "UPDATE clinics SET name = ?, address = ?, phone = ?, whatsapp = ?, opening_hours = ?, location = ?, social_media = ? WHERE id = ?"
  ).run(
    data.name ?? clinic.name,
    data.address ?? clinic.address,
    data.phone ?? clinic.phone,
    data.whatsapp ?? clinic.whatsapp,
    data.opening_hours ?? clinic.opening_hours,
    data.location ?? clinic.location,
    data.social_media ?? clinic.social_media,
    clinic.id
  );
  return getClinic();
}
