import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { listDoctors, createDoctor } from "@/lib/services/doctors";

export async function GET(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;
  return NextResponse.json(listDoctors());
}

export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;
  const body = await request.json().catch(() => null);
  if (!body?.name || !body?.specialty_id) {
    return NextResponse.json({ error: "Nome e especialidade são obrigatórios." }, { status: 400 });
  }
  const doctor = createDoctor({
    name: String(body.name),
    specialty_id: Number(body.specialty_id),
    consultation_duration: body.consultation_duration ? Number(body.consultation_duration) : 30,
    price: body.price !== undefined ? Number(body.price) : 0,
    status: body.status ?? "active",
    phone: body.phone ? String(body.phone) : "",
    schedule: Array.isArray(body.schedule)
      ? body.schedule.map((s: { weekday: unknown; start_time: unknown; end_time: unknown }) => ({
          weekday: Number(s.weekday),
          start_time: String(s.start_time),
          end_time: String(s.end_time),
        }))
      : [],
  });
  return NextResponse.json(doctor, { status: 201 });
}
