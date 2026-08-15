import { NextRequest, NextResponse } from "next/server";
import { runReminderCheck } from "@/lib/services/reminders";
import { requireInternalAuth } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
  const authError = requireInternalAuth(request);
  if (authError) return authError;
  const sent = runReminderCheck();
  return NextResponse.json({ sent });
}
