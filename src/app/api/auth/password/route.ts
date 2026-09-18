import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export async function PUT(request: NextRequest) {
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

  const serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const currentPassword = String(body?.currentPassword ?? "");
  const newPassword = String(body?.newPassword ?? "");
  const confirmPassword = String(body?.confirmPassword ?? "");

  if (!currentPassword) {
    return NextResponse.json({ error: "Informe a senha atual." }, { status: 400 });
  }

  if (!newPassword) {
    return NextResponse.json({ error: "Informe a nova senha." }, { status: 400 });
  }

  if (newPassword.length < 8) {
    return NextResponse.json(
      { error: "A nova senha deve ter no mínimo 8 caracteres." },
      { status: 400 }
    );
  }

  if (newPassword !== confirmPassword) {
    return NextResponse.json(
      { error: "A confirmação da senha não confere." },
      { status: 400 }
    );
  }

  // Verificar senha atual via service_role
  const { error: verifyError } = await serviceClient.auth.signInWithPassword({
    email: user.email!,
    password: currentPassword,
  });

  if (verifyError) {
    console.error("[auth/password] verify error:", JSON.stringify(verifyError, null, 2));
    return NextResponse.json({ error: "Senha atual incorreta." }, { status: 403 });
  }

  // Atualizar senha via service_role
  const { error: updateError } = await serviceClient.auth.admin.updateUserById(
    user.id,
    { password: newPassword }
  );

  if (updateError) {
    console.error("[auth/password] update error:", JSON.stringify(updateError, null, 2));
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  const response = NextResponse.json({ ok: true });
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    response.cookies.set(cookie.name, cookie.value, cookie);
  });

  return response;
}
