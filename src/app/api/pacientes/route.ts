import { NextRequest, NextResponse } from "next/server";
import { requireClinic } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase";
import { auditRequest } from "@/lib/services/audit";

export async function GET(request: NextRequest) {
  const session = await requireClinic(request);
  if (session instanceof NextResponse) return session;
  const { clinicId } = session;

  const { searchParams } = new URL(request.url);
  const phone = searchParams.get("phone") || searchParams.get("telefone");

  if (phone) {
    // maybeSingle: "0 linhas" e "N linhas" nao podem virar o mesmo 404 generico.
    const { data, error } = await supabaseAdmin
      .from("patients")
      .select("*")
      .eq("clinic_id", clinicId)
      .eq("phone", phone)
      .order("created_at", { ascending: false })
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: `Falha ao consultar o paciente: ${error.message}` },
        { status: 500 }
      );
    }
    if (!data) {
      return NextResponse.json(
        { error: "Paciente não encontrado para este telefone." },
        { status: 404 }
      );
    }

    return NextResponse.json(data);
  }

  const { data, error } = await supabaseAdmin
    .from("patients")
    .select("*")
    .eq("clinic_id", clinicId)
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const session = await requireClinic(request);
  if (session instanceof NextResponse) return session;
  const { clinicId } = session;

  const body = await request.json().catch(() => null);
  if (!body?.name || !body?.phone) {
    return NextResponse.json(
      { error: "Nome e telefone são obrigatórios." },
      { status: 400 }
    );
  }

  // clinic_id vem SEMPRE da sessão (servidor): um clinic_id no corpo é
  // ignorado, para o chamador nunca criar pacientes em outra clínica.
  const { data, error } = await supabaseAdmin
    .from("patients")
    .insert({
      clinic_id: clinicId,
      name: String(body.name),
      phone: String(body.phone),
      email: body.email ? String(body.email) : "",
      cpf: body.cpf ? String(body.cpf) : "",
      date_of_birth: body.date_of_birth || null,
      address: body.address ? String(body.address) : "",
      notes: body.notes ? String(body.notes) : "",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await auditRequest(request, {
    action: "patient.create",
    entity: "patients",
    entityId: data.id,
    clinicId,
  });

  return NextResponse.json(data, { status: 201 });
}
