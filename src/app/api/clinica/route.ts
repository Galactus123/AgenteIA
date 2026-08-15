import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getClinic, updateClinic } from "@/lib/services/clinics";

export async function GET(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;
  return NextResponse.json(getClinic());
}

export async function PUT(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  const clinic = updateClinic({
    name: body.name,
    address: body.address,
    phone: body.phone,
    whatsapp: body.whatsapp,
    opening_hours: body.opening_hours,
    location: body.location,
    social_media: body.social_media ? JSON.stringify(body.social_media) : undefined,
  });
  return NextResponse.json(clinic);
}
