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

  // Client com service_role para queries que bypassam RLS
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
  console.log("DEBUG LOGIN ERROR: STEP 1 - email:", email);

  // Usar o client com anon key + cookies para signInWithPassword (service_role causa "Database error querying schema")
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  console.log("DEBUG LOGIN ERROR: STEP 2 - signIn result:", JSON.stringify({ hasData: !!data, hasError: !!error, errorMessage: error?.message, errorCode: error?.code, userId: data?.user?.id }));

  if (error) {
    console.error("[auth/login] signInWithPassword error:", JSON.stringify(error, null, 2));
    console.error("DEBUG LOGIN ERROR: STEP 2 FAILED:", JSON.stringify(error, null, 2));
    return NextResponse.json(
      { error: error.message, code: error.code, status: error.status },
      { status: 401 }
    );
  }

  if (!data.user) {
    console.error("DEBUG LOGIN ERROR: STEP 2 FAILED - no user in data");
    return NextResponse.json({ error: "Usuário não encontrado." }, { status: 401 });
  }

  console.log("[auth/login] signInWithPassword OK, user:", data.user.id, data.user.email);

  // Buscar dados do admin_profiles com service_role (bypassa RLS)
  let adminProfile = null;
  try {
    console.log("DEBUG LOGIN ERROR: STEP 3 - querying admin_profiles for user_id:", data.user.id);
    const { data: profile, error: profileError } = await serviceClient
      .from("admin_profiles")
      .select("role, legacy_username")
      .eq("user_id", data.user.id)
      .single();

    if (profileError) {
      console.error("[auth/login] admin_profiles query error:", JSON.stringify(profileError, null, 2));
      console.error("DEBUG LOGIN ERROR: STEP 3 FAILED:", JSON.stringify(profileError, null, 2));
    } else {
      adminProfile = profile;
      console.log("[auth/login] admin_profile found:", profile);
      console.log("DEBUG LOGIN ERROR: STEP 3 OK:", JSON.stringify(profile));
    }
  } catch (e) {
    console.error("[auth/login] admin_profiles unexpected error:", e);
    console.error("DEBUG LOGIN ERROR: STEP 3 EXCEPTION:", JSON.stringify(e));
  }

  // Buscar clínicas do usuário com service_role
  let clinicIds: string[] = [];
  try {
    console.log("DEBUG LOGIN ERROR: STEP 4 - querying clinic_members for user_id:", data.user.id);
    const { data: clinics, error: clinicError } = await serviceClient
      .from("clinic_members")
      .select("clinic_id")
      .eq("user_id", data.user.id)
      .eq("active", true);

    if (clinicError) {
      console.error("[auth/login] clinic_members query error:", JSON.stringify(clinicError, null, 2));
      console.error("DEBUG LOGIN ERROR: STEP 4 FAILED:", JSON.stringify(clinicError, null, 2));
    } else if (clinics) {
      clinicIds = clinics.map((c) => String(c.clinic_id));
      console.log("[auth/login] clinic_ids:", clinicIds);
      console.log("DEBUG LOGIN ERROR: STEP 4 OK:", JSON.stringify(clinicIds));
    }
  } catch (e) {
    console.error("[auth/login] clinic_members unexpected error:", e);
    console.error("DEBUG LOGIN ERROR: STEP 4 EXCEPTION:", JSON.stringify(e));
  }

  console.log("DEBUG LOGIN ERROR: STEP 5 - returning response with user:", data.user.id, "adminProfile:", adminProfile, "clinicIds:", clinicIds);

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
