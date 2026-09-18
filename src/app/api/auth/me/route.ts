import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {},
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ authenticated: false }, { status: 200 });
  }

  // Buscar dados do admin_profiles com service_role (bypassa RLS)
  const serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: adminProfile } = await serviceClient
    .from("admin_profiles")
    .select("role, legacy_username, legacy_admin_id")
    .eq("user_id", user.id)
    .single();

  return NextResponse.json({
    authenticated: true,
    user: {
      id: user.id,
      email: user.email,
      role: adminProfile?.role ?? "admin",
      username: adminProfile?.legacy_username ?? user.email,
    },
  });
}
