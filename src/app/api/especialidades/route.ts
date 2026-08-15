import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { listSpecialties, createSpecialty } from "@/lib/services/specialties";

export async function GET(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;
  return NextResponse.json(listSpecialties());
}

export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;
  const body = await request.json().catch(() => null);
  if (!body?.name) return NextResponse.json({ error: "Nome é obrigatório." }, { status: 400 });
  try {
    const specialty = createSpecialty({
      name: String(body.name),
      description: body.description ? String(body.description) : "",
      keywords: Array.isArray(body.keywords) ? body.keywords.map(String) : [],
    });
    return NextResponse.json(specialty, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Já existe uma especialidade com esse nome." }, { status: 409 });
  }
}
