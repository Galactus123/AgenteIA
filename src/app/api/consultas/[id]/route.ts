import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase";

const STATUS_PERMITIDOS = ["scheduled", "completed", "cancelled"];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const { id } = await params;
  const body = await request.json().catch(() => null);

  if (!body?.status || !STATUS_PERMITIDOS.includes(body.status)) {
    return NextResponse.json(
      { error: `Status inválido. Valores permitidos: ${STATUS_PERMITIDOS.join(", ")}` },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("appointments")
    .update({ status: body.status })
    .eq("id", id)
    .select(`
      *,
      patient:patients(id, name, phone),
      professional:professionals(id, name, specialty_name)
    `)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Consulta não encontrada." }, { status: 404 });
  }

  return NextResponse.json(data);
}
