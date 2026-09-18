import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getStats } from "@/lib/services/stats";

export async function GET(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) return authError;
  return NextResponse.json(getStats());
}
