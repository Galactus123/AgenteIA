import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { recordAudit } from "@/lib/services/audit";
import { maskEmail } from "@/lib/lgpd";

// Papéis que podem operar sem clinic_members (plataforma, não tenant).
const PLATFORM_ROLES = new Set(["super_admin", "saas_admin"]);

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

  // Anti forca bruta: teto por IP (varredura) e por e-mail (ataque focado).
  const byIp = rateLimit(`login:ip:${clientIp(request)}`, 30, 5 * 60_000);
  if (!byIp.ok) return tooManyRequests(byIp.retryAfterSec);
  const byEmail = rateLimit(`login:email:${email}`, 10, 5 * 60_000);
  if (!byEmail.ok) return tooManyRequests(byEmail.retryAfterSec);

  // signInWithPassword precisa do client anon + cookies: usar service_role
  // aqui dispara "Database error querying schema" no GoTrue.
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    // Sem e-mail/ID nos logs (PII); o código do GoTrue já orienta a causa.
    console.error("[auth/login] signInWithPassword:", error.code ?? error.status, error.message);
    // Trilha de auditoria guarda o e-mail mascarado, nunca o cru.
    await recordAudit({
      action: "auth.login_failed",
      actorLabel: maskEmail(email),
      meta: { code: error.code ?? String(error.status ?? "") },
      ip: clientIp(request),
    });
    return NextResponse.json(
      { error: error.message, code: error.code, status: error.status },
      { status: 401 }
    );
  }

  if (!data.user) {
    return NextResponse.json({ error: "Usuário não encontrado." }, { status: 401 });
  }

  const userId = data.user.id;

  const { data: adminProfile, error: profileError } = await serviceClient
    .from("admin_profiles")
    .select("role, legacy_username")
    .eq("user_id", userId)
    .maybeSingle();

  if (profileError) {
    console.error("[auth/login] falha ao ler admin_profiles:", profileError.code, profileError.message);
    return NextResponse.json(
      { error: "Não foi possível verificar o perfil do usuário.", code: "PROFILE_QUERY_FAILED" },
      { status: 500 }
    );
  }

  // Sem perfil não há papel: hoje isso virava fallback silencioso ("admin").
  if (!adminProfile) {
    console.error("[auth/login] admin_profiles ausente para user_id:", userId);
    await recordAudit({
      action: "auth.login_blocked",
      actorId: userId,
      actorLabel: maskEmail(email),
      meta: { code: "PROFILE_MISSING" },
      ip: clientIp(request),
    });
    return NextResponse.json(
      {
        error: "Perfil administrativo não encontrado para este usuário. Contate o suporte.",
        code: "PROFILE_MISSING",
      },
      { status: 403 }
    );
  }

  const { data: clinics, error: clinicError } = await serviceClient
    .from("clinic_members")
    .select("clinic_id")
    .eq("user_id", userId)
    .eq("active", true);

  if (clinicError) {
    console.error("[auth/login] falha ao ler clinic_members:", clinicError.code, clinicError.message);
    return NextResponse.json(
      { error: "Não foi possível verificar as clínicas do usuário.", code: "CLINIC_QUERY_FAILED" },
      { status: 500 }
    );
  }

  const clinicIds = (clinics ?? []).map((c) => String(c.clinic_id));

  // Sem clínica o RLS devolve vazio em toda leitura autenticada — bloquear
  // aqui é melhor do que entregar um painel em branco.
  if (clinicIds.length === 0 && !PLATFORM_ROLES.has(adminProfile.role)) {
    console.error("[auth/login] clinic_members vazio para user_id:", userId);
    await recordAudit({
      action: "auth.login_blocked",
      actorId: userId,
      actorLabel: maskEmail(email),
      meta: { code: "CLINIC_MISSING", role: adminProfile.role },
      ip: clientIp(request),
    });
    return NextResponse.json(
      {
        error: "Este usuário não está vinculado a nenhuma clínica. Contate o suporte.",
        code: "CLINIC_MISSING",
      },
      { status: 403 }
    );
  }

  await recordAudit({
    actorId: userId,
    actorLabel: maskEmail(email),
    action: "auth.login",
    entity: "users",
    entityId: userId,
    clinicId: clinicIds[0] ? Number(clinicIds[0]) : undefined,
    meta: { role: adminProfile.role, clinics: clinicIds.length },
    ip: clientIp(request),
  });

  const response = NextResponse.json({
    ok: true,
    user: {
      id: data.user.id,
      email: data.user.email,
      role: adminProfile.role,
      username: adminProfile.legacy_username ?? data.user.email,
      clinicIds,
    },
  });

  // Copy session cookies from supabaseResponse to our response
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    response.cookies.set(cookie.name, cookie.value, cookie);
  });

  return response;
}
