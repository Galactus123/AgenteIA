import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import {
  listAppointmentsFiltered,
  createAppointment,
} from "@/lib/services/appointments";
import { isSlotAvailable } from "@/lib/services/appointments";

export async function GET(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const searchParams = request.nextUrl.searchParams;
  const date = searchParams.get("date") ?? undefined;
  const status = searchParams.get("status") ?? undefined;

  return NextResponse.json(
    listAppointmentsFiltered({ date, status })
  );
}

export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json(
      { error: "Corpo da requisição inválido." },
      { status: 400 }
    );
  }

  const patientName = body.patient_name ? String(body.patient_name) : undefined;
  const patientPhone = body.patient_phone
    ? String(body.patient_phone).replace(/\D/g, "")
    : undefined;
  const specialtyId = body.specialty_id ? Number(body.specialty_id) : undefined;
  const doctorId = body.doctor_id ? Number(body.doctor_id) : undefined;
  const startsAt = body.starts_at ? String(body.starts_at) : undefined;
  const reason = body.reason !== undefined ? String(body.reason) : "";

  if (!patientName) {
    return NextResponse.json(
      { error: "Nome do paciente é obrigatório." },
      { status: 400 }
    );
  }
  if (!patientPhone) {
    return NextResponse.json(
      { error: "Telefone do paciente é obrigatório." },
      { status: 400 }
    );
  }
  if (!specialtyId) {
    return NextResponse.json(
      { error: "ID da especialidade é obrigatório." },
      { status: 400 }
    );
  }
  if (!doctorId) {
    return NextResponse.json(
      { error: "ID do médico é obrigatório." },
      { status: 400 }
    );
  }
  if (!startsAt) {
    return NextResponse.json(
      { error: "Data/hora da consulta é obrigatória." },
      { status: 400 }
    );
  }

  if (!isSlotAvailable(doctorId, startsAt)) {
    return NextResponse.json(
      { error: "Este horário já está ocupado." },
      { status: 409 }
    );
  }

  try {
    const appointment = createAppointment({
      patient_name: patientName,
      patient_phone: patientPhone,
      specialty_id: specialtyId,
      doctor_id: doctorId,
      starts_at: startsAt,
      reason,
      source: body.source ?? "api",
    });
    return NextResponse.json({ ok: true, appointment }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao criar agendamento." },
      { status: 500 }
    );
  }
}