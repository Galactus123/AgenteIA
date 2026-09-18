import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const phone = searchParams.get("phone") || searchParams.get("telefone");

  if (phone) {
    const { data, error } = await supabaseAdmin
      .from("patients")
      .select("*")
      .eq("phone", phone)
      .single();

    if (error) {
      return NextResponse.json({ error: "Paciente não encontrado." }, { status: 404 });
    }

    return NextResponse.json(data);
  }

  const { data, error } = await supabaseAdmin
    .from("patients")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const body = await request.json().catch(() => null);
  if (!body?.name || !body?.phone) {
    return NextResponse.json(
      { error: "Nome e telefone são obrigatórios." },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("patients")
    .insert({
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

  return NextResponse.json(data, { status: 201 });
}
