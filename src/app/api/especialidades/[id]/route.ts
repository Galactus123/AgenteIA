import { NextRequest, NextResponse } from "next/server";
import { requireClinic } from "@/lib/api-auth";
import { updateSpecialty, deleteSpecialty, getSpecialty } from "@/lib/services/specialties";
import { auditRequest } from "@/lib/services/audit";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, ctx: RouteContext) {
  const session = await requireClinic(request);
  if (session instanceof NextResponse) return session;
  const { clinicId, user } = session;

  const { id } = await ctx.params;
  const body = await request.json().catch(() => null);
  // Ownership: id de outra clínica → 404 (não se confirma a existência).
  const existing = await getSpecialty(Number(id), clinicId);
  if (!existing) return NextResponse.json({ error: "Especialidade não encontrada." }, { status: 404 });
  try {
    const specialty = await updateSpecialty(
      Number(id),
      {
        name: body?.name ? String(body.name) : undefined,
        description: body?.description !== undefined ? String(body.description) : undefined,
        keywords: Array.isArray(body?.keywords) ? body.keywords.map(String) : undefined,
      },
      clinicId
    );
    await auditRequest(request, {
      action: "specialty.update",
      entity: "specialties",
      entityId: id,
      clinicId,
      user,
    });
    return NextResponse.json(specialty);
  } catch {
    return NextResponse.json({ error: "Nome já em uso." }, { status: 409 });
  }
}

export async function DELETE(request: NextRequest, ctx: RouteContext) {
  const session = await requireClinic(request);
  if (session instanceof NextResponse) return session;
  const { clinicId, user } = session;

  const { id } = await ctx.params;
  const existing = await getSpecialty(Number(id), clinicId);
  if (!existing) return NextResponse.json({ error: "Especialidade não encontrada." }, { status: 404 });
  await deleteSpecialty(Number(id), clinicId);
  await auditRequest(request, {
    action: "specialty.delete",
    entity: "specialties",
    entityId: id,
    clinicId,
    user,
  });
  return NextResponse.json({ ok: true });
}
