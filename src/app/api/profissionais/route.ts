import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const { data, error } = await supabaseAdmin
    .from("profissionais")
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
  if (!body?.nome || !body?.especialidade) {
    return NextResponse.json(
      { error: "Nome e especialidade são obrigatórios." },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("profissionais")
    .insert({
      nome: String(body.nome),
      especialidade: String(body.especialidade),
      telefone: body.telefone ? String(body.telefone) : null,
      email: body.email ? String(body.email) : null,
      horarios: body.horarios ?? null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
