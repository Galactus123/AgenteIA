import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

export async function PUT(request: NextRequest) {
  // Alteração de e-mail confirma a senha atual a cada tentativa: mesmo teto
  // de IP da troca de senha, contra adivinhação com sessão em mãos.
  const byIp = rateLimit(`email:ip:${clientIp(request)}`, 15, 5 * 60_000);
  if (!byIp.ok) return tooManyRequests(byIp.retryAfterSec);

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
  const email = String(body?.email ?? "").trim();
  const currentPassword = String(body?.currentPassword ?? "");

  if (!email) {
    return NextResponse.json({ error: "Informe o novo e-mail." }, { status: 400 });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return NextResponse.json({ error: "Formato de e-mail inválido." }, { status: 400 });
  }

  if (!currentPassword) {
    return NextResponse.json(
      { error: "Informe a senha atual para confirmar a alteração." },
      { status: 400 }
    );
  }

  // Verificar senha atual via service_role
  const { error: verifyError } = await serviceClient.auth.signInWithPassword({
    email: user.email!,
    password: currentPassword,
  });

  if (verifyError) {
    // So codigo/mensagem: o objeto completo do GoTrue pode carregar e-mail (PII).
    console.error("[auth/email] verify error:", verifyError.code ?? verifyError.status, verifyError.message);
    return NextResponse.json({ error: "Senha atual incorreta." }, { status: 403 });
  }

  // Atualizar e-mail via Supabase Auth
  const { error: updateError } = await serviceClient.auth.admin.updateUserById(
    user.id,
    { email }
  );

  if (updateError) {
    console.error("[auth/email] update error:", updateError.code ?? updateError.status, updateError.message);
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  const response = NextResponse.json({ ok: true, email });
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    response.cookies.set(cookie.name, cookie.value, cookie);
  });

  return response;
}
