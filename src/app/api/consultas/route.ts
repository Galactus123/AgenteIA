import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const { data, error } = await supabaseAdmin
    .from("appointments")
    .select(`
      *,
      patient:patients(id, name, phone),
      professional:professionals(id, name, specialty_name)
    `)
    .order("starts_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const body = await request.json().catch(() => null);
  if (!body?.patient_id || !body?.professional_id || !body?.starts_at) {
    return NextResponse.json(
      { error: "patient_id, professional_id e starts_at são obrigatórios." },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("appointments")
    .insert({
      patient_id: body.patient_id,
      professional_id: body.professional_id,
      patient_name: body.patient_name || "",
      patient_phone: body.patient_phone || "",
      specialty_id: body.specialty_id || null,
      starts_at: String(body.starts_at),
      ends_at: body.ends_at ? String(body.ends_at) : null,
      reason: body.reason ? String(body.reason) : null,
      status: body.status ?? "scheduled",
      source: body.source ?? "ia",
    })
    .select(`
      *,
      patient:patients(id, name, phone),
      professional:professionals(id, name, specialty_name)
    `)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
