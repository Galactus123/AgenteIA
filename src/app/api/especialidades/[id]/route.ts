import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { updateSpecialty, deleteSpecialty, getSpecialty } from "@/lib/services/specialties";
import { auditRequest } from "@/lib/services/audit";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, ctx: RouteContext) {
  const authError = await requireAuth(request);
  if (authError) return authError;
  const { id } = await ctx.params;
  const body = await request.json().catch(() => null);
  const existing = await getSpecialty(Number(id));
  if (!existing) return NextResponse.json({ error: "Especialidade não encontrada." }, { status: 404 });
  try {
    const specialty = await updateSpecialty(Number(id), {
      name: body?.name ? String(body.name) : undefined,
      description: body?.description !== undefined ? String(body.description) : undefined,
      keywords: Array.isArray(body?.keywords) ? body.keywords.map(String) : undefined,
    });
    await auditRequest(request, {
      action: "specialty.update",
      entity: "specialties",
      entityId: id,
    });
    return NextResponse.json(specialty);
  } catch {
    return NextResponse.json({ error: "Nome já em uso." }, { status: 409 });
  }
}

export async function DELETE(request: NextRequest, ctx: RouteContext) {
  const authError = await requireAuth(request);
  if (authError) return authError;
  const { id } = await ctx.params;
  const existing = await getSpecialty(Number(id));
  if (!existing) return NextResponse.json({ error: "Especialidade não encontrada." }, { status: 404 });
  await deleteSpecialty(Number(id));
  await auditRequest(request, {
    action: "specialty.delete",
    entity: "specialties",
    entityId: id,
  });
  return NextResponse.json({ ok: true });
}
