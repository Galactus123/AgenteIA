import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

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

  const body = await request.json().catch(() => null);
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");

  if (!email || !password) {
    return NextResponse.json({ error: "Email e senha são obrigatórios." }, { status: 400 });
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error("[auth/login] Supabase signInWithPassword error:", {
      message: error.message,
      status: error.status,
      code: error.code,
    });
    return NextResponse.json(
      { error: error.message, code: error.code, status: error.status },
      { status: 401 }
    );
  }

  console.log("[auth/login] signInWithPassword OK, user:", data.user.id, data.user.email);

  // Buscar dados do admin_profiles
  let adminProfile = null;
  try {
    const { data: profile, error: profileError } = await supabase
      .from("admin_profiles")
      .select("role, legacy_username")
      .eq("user_id", data.user.id)
      .single();

    if (profileError) {
      console.error("[auth/login] admin_profiles query error:", {
        message: profileError.message,
        code: profileError.code,
        details: profileError.details,
        hint: profileError.hint,
      });
    } else {
      adminProfile = profile;
      console.log("[auth/login] admin_profile found:", profile);
    }
  } catch (e) {
    console.error("[auth/login] admin_profiles unexpected error:", e);
  }

  const response = NextResponse.json({
    ok: true,
    user: {
      id: data.user.id,
      email: data.user.email,
      role: adminProfile?.role ?? "admin",
      username: adminProfile?.legacy_username ?? data.user.email,
    },
  });

  // Copy session cookies from supabaseResponse to our response
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    response.cookies.set(cookie.name, cookie.value, cookie);
  });

  return response;
}
