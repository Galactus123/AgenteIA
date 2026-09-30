import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase";
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
  const authError = await requireAuth(request);
  if (authError) return authError;

  const { id } = await ctx.params;
  const appointment = await getAppointmentView(Number(id));
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
  const authError = await requireAuth(request);
  if (authError) return authError;

  const { id } = await ctx.params;
  const appointment = await getAppointment(Number(id));
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
      await cancelAppointment(Number(id));
      return NextResponse.json({
        ok: true,
        appointment: await getAppointmentView(Number(id)),
      });
    }

    if (status === "completed") {
      const { error } = await supabaseAdmin
        .from("appointments")
        .update({
          status: "completed",
          updated_at: new Date().toISOString().slice(0, 16).replace("T", " "),
        })
        .eq("id", Number(id));

      if (error) {
        return NextResponse.json(
          { error: `Falha ao actualizar o estado: ${error.message}` },
          { status: 500 }
        );
      }
      return NextResponse.json({
        ok: true,
        appointment: await getAppointmentView(Number(id)),
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
  const authError = await requireAuth(request);
  if (authError) return authError;

  const { id } = await ctx.params;
  const appointment = await getAppointment(Number(id));
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
    const updated = await rescheduleAppointment(Number(id), String(body.new_starts_at));
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
  const authError = await requireAuth(request);
  if (authError) return authError;

  const { id } = await ctx.params;
  const appointment = await getAppointment(Number(id));
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

  await cancelAppointment(Number(id));
  return NextResponse.json({ ok: true, appointment: await getAppointmentView(Number(id)) });
}
