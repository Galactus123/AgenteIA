import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { ACTIVE_CLINIC_COOKIE, activeClinicCookieOptions } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  await supabase.auth.signOut();

  const response = NextResponse.json({ ok: true });
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    response.cookies.set(cookie.name, cookie.value, cookie);
  });

  // Multi-clínica: a clínica ativa é da sessão que terminou — sem limpar o
  // cookie, o próximo utilizador deste navegador começava com a escolha do
  // anterior (o vínculo invalidaria o valor na mesma, mas não deve restar).
  response.cookies.set(ACTIVE_CLINIC_COOKIE, "", {
    ...activeClinicCookieOptions(),
    maxAge: 0,
  });

  return response;
}
