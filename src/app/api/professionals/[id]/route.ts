import { NextRequest, NextResponse } from "next/server";
import { requireClinic } from "@/lib/api-auth";
import { getDoctor, updateDoctor, deleteDoctor } from "@/lib/services/doctors";
import type { ScheduleInput } from "@/lib/services/doctors";
import { auditRequest } from "@/lib/services/audit";

type RouteContext = { params: Promise<{ id: string }> };

function message(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

async function handleUpdate(request: NextRequest, ctx: RouteContext) {
  const session = await requireClinic(request);
  if (session instanceof NextResponse) return session;
  const { clinicId, user } = session;

  const { id } = await ctx.params;
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });

  // Ownership: profissional de outra clínica → 404.
  const existing = await getDoctor(id, clinicId);
  if (!existing) return NextResponse.json({ error: "Profissional não encontrado." }, { status: 404 });

  const patch: Parameters<typeof updateDoctor>[1] = {};
  if (body.name !== undefined) patch.name = String(body.name);
  if (body.email !== undefined) patch.email = String(body.email);
  if (body.specialty_id !== undefined) patch.specialty_id = Number(body.specialty_id);
  if (body.consultation_duration !== undefined) patch.consultation_duration = Number(body.consultation_duration);
  if (body.price !== undefined) patch.price = Number(body.price);
  if (body.status !== undefined) patch.status = String(body.status);
  if (body.phone !== undefined) patch.phone = String(body.phone);
  if (body.schedule !== undefined) {
    patch.schedule = (Array.isArray(body.schedule) ? body.schedule : []) as ScheduleInput;
  }

  try {
    const doctor = await updateDoctor(id, patch, clinicId);
    // Apenas os campos alterados: valores (nome/e-mail/telefone) nao vao para a trilha.
    await auditRequest(request, {
      action: "professional.update",
      entity: "professionals",
      entityId: id,
      clinicId,
      user,
      meta: { fields: Object.keys(patch) },
    });
    return NextResponse.json(doctor);
  } catch (err) {
    return NextResponse.json({ error: message(err, "Erro ao atualizar profissional.") }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, ctx: RouteContext) {
  return handleUpdate(request, ctx);
}

export async function PUT(request: NextRequest, ctx: RouteContext) {
  return handleUpdate(request, ctx);
}

export async function DELETE(request: NextRequest, ctx: RouteContext) {
  const session = await requireClinic(request);
  if (session instanceof NextResponse) return session;
  const { clinicId, user } = session;

  const { id } = await ctx.params;
  const existing = await getDoctor(id, clinicId);
  if (!existing) return NextResponse.json({ error: "Profissional não encontrado." }, { status: 404 });

  try {
    await deleteDoctor(id, clinicId);
    await auditRequest(request, {
      action: "professional.delete",
      entity: "professionals",
      entityId: id,
      clinicId,
      user,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: message(err, "Erro ao excluir profissional.") }, { status: 500 });
  }
}
