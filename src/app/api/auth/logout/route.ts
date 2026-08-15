import { NextResponse } from "next/server";
import { authCookie } from "@/lib/auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(authCookie, "", { httpOnly: true, path: "/", maxAge: 0 });
  return response;
}
