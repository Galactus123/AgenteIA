import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { updateDoctor, deleteDoctor, getDoctor } from "@/lib/services/doctors";

export async function PUT(request: NextRequest, ctx: RouteContext<"/api/medicos/[id]">) {
  const authError = requireAuth(request);
  if (authError) return authError;
  const { id } = await ctx.params;
  const body = await request.json().catch(() => null);
  if (!getDoctor(Number(id))) {
    return NextResponse.json({ error: "Médico não encontrado." }, { status: 404 });
  }
  const doctor = updateDoctor(Number(id), {
    name: body?.name ? String(body.name) : undefined,
    specialty_id: body?.specialty_id ? Number(body.specialty_id) : undefined,
    consultation_duration:
      body?.consultation_duration !== undefined ? Number(body.consultation_duration) : undefined,
    price: body?.price !== undefined ? Number(body.price) : undefined,
    status: body?.status ? String(body.status) : undefined,
    phone: body?.phone !== undefined ? String(body.phone) : undefined,
    schedule: Array.isArray(body?.schedule)
      ? body.schedule.map((s: { weekday: unknown; start_time: unknown; end_time: unknown }) => ({
          weekday: Number(s.weekday),
          start_time: String(s.start_time),
          end_time: String(s.end_time),
        }))
      : undefined,
  });
  return NextResponse.json(doctor);
}

export async function DELETE(request: NextRequest, ctx: RouteContext<"/api/medicos/[id]">) {
  const authError = requireAuth(request);
  if (authError) return authError;
  const { id } = await ctx.params;
  if (!getDoctor(Number(id))) {
    return NextResponse.json({ error: "Médico não encontrado." }, { status: 404 });
  }
  deleteDoctor(Number(id));
  return NextResponse.json({ ok: true });
}
