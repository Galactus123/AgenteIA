import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { auditRequest } from "@/lib/services/audit";
import {
  listAppointmentsFiltered,
  createAppointment,
  isSlotAvailable,
  SlotTakenError,
  OutsideHoursError,
} from "@/lib/services/appointments";
import { MAX_PATIENT_NAME_LENGTH } from "@/lib/agent/security";

const MAX_REASON_LENGTH = 500;

export async function GET(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const searchParams = request.nextUrl.searchParams;
  const date = searchParams.get("date") ?? undefined;
  const status = searchParams.get("status") ?? undefined;

  return NextResponse.json(
    await listAppointmentsFiltered({ date, status })
  );
}

export async function POST(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json(
      { error: "Corpo da requisicao invalido." },
      { status: 400 }
    );
  }

  const patientName = body.patient_name ? String(body.patient_name).slice(0, MAX_PATIENT_NAME_LENGTH) : undefined;
  const patientPhone = body.patient_phone
    ? String(body.patient_phone).replace(/\D/g, "")
    : undefined;
  const specialtyId = body.specialty_id ? Number(body.specialty_id) : undefined;
  const professionalId = body.professional_id
    ? String(body.professional_id)
    : body.doctor_id
      ? String(body.doctor_id)
      : undefined;
  const startsAt = body.starts_at ? String(body.starts_at) : undefined;
  const reason = body.reason !== undefined ? String(body.reason).slice(0, MAX_REASON_LENGTH) : "";

  if (!patientName) {
    return NextResponse.json(
      { error: "Nome do paciente e obrigatorio." },
      { status: 400 }
    );
  }
  if (!patientPhone) {
    return NextResponse.json(
      { error: "Telefone do paciente e obrigatorio." },
      { status: 400 }
    );
  }
  if (!specialtyId) {
    return NextResponse.json(
      { error: "ID da especialidade e obrigatorio." },
      { status: 400 }
    );
  }
  if (!professionalId) {
    return NextResponse.json(
      { error: "ID do medico e obrigatorio." },
      { status: 400 }
    );
  }
  if (!startsAt) {
    return NextResponse.json(
      { error: "Data/hora da consulta e obrigatoria." },
      { status: 400 }
    );
  }

  if (!(await isSlotAvailable(professionalId, startsAt))) {
    return NextResponse.json(
      { error: "Este horario ja esta ocupado.", code: "SLOT_TAKEN" },
      { status: 409 }
    );
  }

  try {
    const appointment = await createAppointment({
      patient_name: patientName,
      patient_phone: patientPhone,
      specialty_id: specialtyId,
      professional_id: professionalId,
      starts_at: startsAt,
      reason,
      source: body.source ?? "api",
    });
    await auditRequest(request, {
      action: "appointment.create",
      entity: "appointments",
      entityId: appointment.id,
      meta: { professional_id: professionalId, starts_at: startsAt },
    });
    return NextResponse.json({ ok: true, appointment }, { status: 201 });
  } catch (err) {
    // Corrida de horario: outra requisicao ocupou o slot entre a
    // verificacao e o insert (indice unico) — devolve 409 amigavel.
    if (err instanceof SlotTakenError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 409 });
    }
    // Fora do expediente do profissional / horario no passado (Fase 3.6).
    if (err instanceof OutsideHoursError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao criar agendamento." },
      { status: 500 }
    );
  }
}