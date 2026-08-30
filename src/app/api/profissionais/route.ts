import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const { data, error } = await supabaseAdmin
    .from("medicos")
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
  if (!body?.nome) {
    return NextResponse.json(
      { error: "Nome é obrigatório." },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("medicos")
    .insert({
      nome: String(body.nome),
      especialidade_id: body.especialidade_id ? String(body.especialidade_id) : null,
      telefone: body.telefone ? String(body.telefone) : null,
      duracao_consulta: body.duracao_consulta ? Number(body.duracao_consulta) : 30,
      valor_consulta: body.valor_consulta !== undefined ? Number(body.valor_consulta) : 0,
      status: body.status ?? "Ativo",
      dias_atendimento: body.dias_atendimento ?? [],
    })
    .select()
    .single();

  if (error) {
    console.error("Erro ao cadastrar médico no Supabase:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
