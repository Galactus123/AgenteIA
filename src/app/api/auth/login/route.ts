import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  // Client com anon key para gerenciar cookies da sessão
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

  // Client com service_role para auth e queries que bypassam RLS
  const serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const body = await request.json().catch(() => null);
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");

  if (!email || !password) {
    return NextResponse.json({ error: "Email e senha são obrigatórios." }, { status: 400 });
  }

  console.log("[auth/login] Tentando signInWithPassword para:", email);

  const { data, error } = await serviceClient.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error("ERRO COMPLETO SUPABASE LOGIN:", JSON.stringify(error, null, 2));
    return NextResponse.json(
      { error: error.message, code: error.code, status: error.status },
      { status: 401 }
    );
  }

  console.log("[auth/login] signInWithPassword OK, user:", data.user.id, data.user.email);

  // Buscar dados do admin_profiles com service_role (bypassa RLS)
  let adminProfile = null;
  try {
    const { data: profile, error: profileError } = await serviceClient
      .from("admin_profiles")
      .select("role, legacy_username")
      .eq("user_id", data.user.id)
      .single();

    if (profileError) {
      console.error("[auth/login] admin_profiles query error:", JSON.stringify(profileError, null, 2));
    } else {
      adminProfile = profile;
      console.log("[auth/login] admin_profile found:", profile);
    }
  } catch (e) {
    console.error("[auth/login] admin_profiles unexpected error:", e);
  }

  // Buscar clínicas do usuário com service_role
  let clinicIds: string[] = [];
  try {
    const { data: clinics, error: clinicError } = await serviceClient
      .from("clinic_members")
      .select("clinic_id")
      .eq("user_id", data.user.id)
      .eq("active", true);

    if (clinicError) {
      console.error("[auth/login] clinic_members query error:", JSON.stringify(clinicError, null, 2));
    } else if (clinics) {
      clinicIds = clinics.map((c) => String(c.clinic_id));
      console.log("[auth/login] clinic_ids:", clinicIds);
    }
  } catch (e) {
    console.error("[auth/login] clinic_members unexpected error:", e);
  }

  // Fazer signIn no client com cookies para manter a sessão no browser
  await supabase.auth.signInWithPassword({ email, password });

  const response = NextResponse.json({
    ok: true,
    user: {
      id: data.user.id,
      email: data.user.email,
      role: adminProfile?.role ?? "admin",
      username: adminProfile?.legacy_username ?? data.user.email,
      clinicIds,
    },
  });

  // Copy session cookies from supabaseResponse to our response
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    response.cookies.set(cookie.name, cookie.value, cookie);
  });

  return response;
}
