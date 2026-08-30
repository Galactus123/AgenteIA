import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const telefone = searchParams.get("telefone");

  if (telefone) {
    const { data, error } = await supabaseAdmin
      .from("pacientes")
      .select("*")
      .eq("telefone", telefone)
      .single();

    if (error) {
      return NextResponse.json({ error: "Paciente não encontrado." }, { status: 404 });
    }

    return NextResponse.json(data);
  }

  const { data, error } = await supabaseAdmin
    .from("pacientes")
    .select("*")
    .order("nome", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const body = await request.json().catch(() => null);
  if (!body?.nome || !body?.telefone) {
    return NextResponse.json(
      { error: "Nome e telefone são obrigatórios." },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("pacientes")
    .insert({
      nome: String(body.nome),
      telefone: String(body.telefone),
      email: body.email ? String(body.email) : null,
      data_nascimento: body.data_nascimento ? String(body.data_nascimento) : null,
      endereco: body.endereco ? String(body.endereco) : null,
      observacoes: body.observacoes ? String(body.observacoes) : null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
