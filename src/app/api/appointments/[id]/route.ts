import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import {
  getAppointment,
  getAppointmentView,
  cancelAppointment,
  rescheduleAppointment,
  canCancel,
  canReschedule,
} from "@/lib/services/appointments";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(
  request: NextRequest,
  ctx: RouteContext
) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const { id } = await ctx.params;
  const appointment = getAppointmentView(Number(id));
  if (!appointment) {
    return NextResponse.json(
      { error: "Consulta não encontrada." },
      { status: 404 }
    );
  }
  return NextResponse.json(appointment);
}

export async function PATCH(
  request: NextRequest,
  ctx: RouteContext
) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const { id } = await ctx.params;
  const appointment = getAppointment(Number(id));
  if (!appointment) {
    return NextResponse.json(
      { error: "Consulta não encontrada." },
      { status: 404 }
    );
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json(
      { error: "Corpo da requisição inválido." },
      { status: 400 }
    );
  }

  const status = body.status ? String(body.status) : undefined;

  if (status && status !== appointment.status) {
    if (status === "cancelled") {
      const check = canCancel(appointment);
      if (!check.ok) {
        return NextResponse.json({ error: check.reason }, { status: 400 });
      }
      cancelAppointment(Number(id));
      return NextResponse.json({
        ok: true,
        appointment: getAppointmentView(Number(id)),
      });
    }

    if (status === "completed") {
      const db = (await import("@/lib/db")).db;
      db.prepare(
        "UPDATE appointments SET status = 'completed', updated_at = ? WHERE id = ?"
      ).run(new Date().toISOString().slice(0, 16).replace("T", " "), Number(id));
      return NextResponse.json({
        ok: true,
        appointment: getAppointmentView(Number(id)),
      });
    }

    return NextResponse.json(
      { error: `Status "${status}" não é permitido.` },
      { status: 400 }
    );
  }

  return NextResponse.json(appointment);
}

export async function PUT(
  request: NextRequest,
  ctx: RouteContext
) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const { id } = await ctx.params;
  const appointment = getAppointment(Number(id));
  if (!appointment) {
    return NextResponse.json(
      { error: "Consulta não encontrada." },
      { status: 404 }
    );
  }

  const body = await request.json().catch(() => null);
  if (!body?.new_starts_at) {
    return NextResponse.json(
      { error: "new_starts_at é obrigatório." },
      { status: 400 }
    );
  }

  const check = canReschedule(appointment);
  if (!check.ok) {
    return NextResponse.json({ error: check.reason }, { status: 400 });
  }

  try {
    const updated = rescheduleAppointment(Number(id), String(body.new_starts_at));
    return NextResponse.json({ ok: true, appointment: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao remarcar." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  ctx: RouteContext
) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const { id } = await ctx.params;
  const appointment = getAppointment(Number(id));
  if (!appointment) {
    return NextResponse.json(
      { error: "Consulta não encontrada." },
      { status: 404 }
    );
  }

  const check = canCancel(appointment);
  if (!check.ok) {
    return NextResponse.json({ error: check.reason }, { status: 400 });
  }

  cancelAppointment(Number(id));
  return NextResponse.json({ ok: true, appointment: getAppointmentView(Number(id)) });
}