import { NextRequest, NextResponse } from "next/server";
import { requireClinic } from "@/lib/api-auth";
import { getClinic, updateClinic } from "@/lib/services/clinics";
import { auditRequest } from "@/lib/services/audit";

export async function GET(request: NextRequest) {
  const session = await requireClinic(request);
  if (session instanceof NextResponse) return session;
  return NextResponse.json(await getClinic(session.clinicId));
}

export async function PUT(request: NextRequest) {
  const session = await requireClinic(request);
  if (session instanceof NextResponse) return session;
  const { clinicId, user } = session;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  const clinic = await updateClinic(clinicId, {
    name: body.name,
    address: body.address,
    phone: body.phone,
    whatsapp: body.whatsapp,
    opening_hours: body.opening_hours,
    location: body.location,
    social_media: body.social_media ? JSON.stringify(body.social_media) : undefined,
  });
  if (!clinic) {
    return NextResponse.json({ error: "Clínica não encontrada." }, { status: 404 });
  }
  // Somente as chaves alteradas: telefone/endereco (PII) ficam fora da trilha.
  await auditRequest(request, {
    action: "clinic.update",
    entity: "clinics",
    entityId: clinic.id,
    clinicId,
    user,
    meta: {
      fields: Object.keys(body).filter(
        (k) => body[k] !== undefined && body[k] !== null && body[k] !== ""
      ),
    },
  });
  return NextResponse.json(clinic);
}
