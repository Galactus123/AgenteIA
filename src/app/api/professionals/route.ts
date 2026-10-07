import { NextRequest, NextResponse } from "next/server";
import { requireClinic } from "@/lib/api-auth";
import { listDoctors, createDoctor } from "@/lib/services/doctors";
import type { ScheduleInput } from "@/lib/services/doctors";
import { auditRequest } from "@/lib/services/audit";
import { guardProfessionalLimit } from "@/lib/services/plan-limits";

function message(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

export async function GET(request: NextRequest) {
  const session = await requireClinic(request);
  if (session instanceof NextResponse) return session;

  try {
    return NextResponse.json(await listDoctors(session.clinicId));
  } catch (err) {
    return NextResponse.json({ error: message(err, "Erro ao listar profissionais.") }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await requireClinic(request);
  if (session instanceof NextResponse) return session;
  const { clinicId, user } = session;

  const body = await request.json().catch(() => null);
  if (!body?.name) {
    return NextResponse.json({ error: "Nome é obrigatório." }, { status: 400 });
  }
  if (body.specialty_id === undefined || body.specialty_id === null || body.specialty_id === "") {
    return NextResponse.json({ error: "Especialidade é obrigatória." }, { status: 400 });
  }

  // Cota do plano: feature professionals_management + maxProfessionals.
  const denied = await guardProfessionalLimit(clinicId);
  if (denied) return NextResponse.json(denied.body, { status: denied.status });

  try {
    const doctor = await createDoctor(clinicId, {
      name: String(body.name),
      email: body.email !== undefined ? String(body.email) : "",
      specialty_id: Number(body.specialty_id),
      consultation_duration: Number(body.consultation_duration ?? 30),
      price: Number(body.price ?? 0),
      status: body.status ? String(body.status) : "active",
      phone: body.phone !== undefined ? String(body.phone) : "",
      schedule: (Array.isArray(body.schedule) ? body.schedule : []) as ScheduleInput,
    });
    await auditRequest(request, {
      action: "professional.create",
      entity: "professionals",
      entityId: doctor.id,
      clinicId,
      user,
      meta: { specialty_id: Number(body.specialty_id) },
    });
    return NextResponse.json(doctor, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: message(err, "Erro ao cadastrar profissional.") }, { status: 500 });
  }
}
