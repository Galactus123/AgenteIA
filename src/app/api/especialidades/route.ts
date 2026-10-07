import { NextRequest, NextResponse } from "next/server";
import { requireClinic } from "@/lib/api-auth";
import { listSpecialties, createSpecialty } from "@/lib/services/specialties";
import { auditRequest } from "@/lib/services/audit";

export async function GET(request: NextRequest) {
  const session = await requireClinic(request);
  if (session instanceof NextResponse) return session;
  return NextResponse.json(await listSpecialties(session.clinicId));
}

export async function POST(request: NextRequest) {
  const session = await requireClinic(request);
  if (session instanceof NextResponse) return session;
  const { clinicId, user } = session;

  const body = await request.json().catch(() => null);
  if (!body?.name) return NextResponse.json({ error: "Nome é obrigatório." }, { status: 400 });
  try {
    const specialty = await createSpecialty(clinicId, {
      name: String(body.name),
      description: body.description ? String(body.description) : "",
      keywords: Array.isArray(body.keywords) ? body.keywords.map(String) : [],
    });
    await auditRequest(request, {
      action: "specialty.create",
      entity: "specialties",
      entityId: (specialty as { id?: number | string }).id ?? null,
      clinicId,
      user,
    });
    return NextResponse.json(specialty, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Já existe uma especialidade com esse nome." }, { status: 409 });
  }
}
