import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { updateSpecialty, deleteSpecialty, getSpecialty } from "@/lib/services/specialties";

export async function PUT(request: NextRequest, ctx: RouteContext<"/api/especialidades/[id]">) {
  const authError = requireAuth(request);
  if (authError) return authError;
  const { id } = await ctx.params;
  const body = await request.json().catch(() => null);
  const existing = getSpecialty(Number(id));
  if (!existing) return NextResponse.json({ error: "Especialidade não encontrada." }, { status: 404 });
  try {
    const specialty = updateSpecialty(Number(id), {
      name: body?.name ? String(body.name) : undefined,
      description: body?.description !== undefined ? String(body.description) : undefined,
      keywords: Array.isArray(body?.keywords) ? body.keywords.map(String) : undefined,
    });
    return NextResponse.json(specialty);
  } catch {
    return NextResponse.json({ error: "Nome já em uso." }, { status: 409 });
  }
}

export async function DELETE(request: NextRequest, ctx: RouteContext<"/api/especialidades/[id]">) {
  const authError = requireAuth(request);
  if (authError) return authError;
  const { id } = await ctx.params;
  const existing = getSpecialty(Number(id));
  if (!existing) return NextResponse.json({ error: "Especialidade não encontrada." }, { status: 404 });
  deleteSpecialty(Number(id));
  return NextResponse.json({ ok: true });
}
