import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabase";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { recordAudit } from "@/lib/services/audit";
import { maskEmail } from "@/lib/lgpd";

// Cria o usuario e, na mesma requisicao, o tenant minimo que o RLS exige:
//   profiles -> admin_profiles -> clinics -> clinic_members
// Sem clinic_members o get_user_clinic_ids() volta vazio e TODA leitura
// autenticada devolve [] (paginas em branco).
//
// Nao ha transacao no PostgREST: cada passo e verificado e, em falha, o
// que ja foi criado e removido em ordem inversa (inclusive o usuario em
// auth.users), para nunca deixar usuario orfao sem clínica.
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
  const name = String(body?.name ?? body?.username ?? "").trim();
  const clinicName = String(body?.clinicName ?? "").trim() || name;

  // Anti-abuse: nao deixa uma origem criar contas em rajada.
  const byIp = rateLimit(`signup:ip:${clientIp(request)}`, 10, 60 * 60_000);
  if (!byIp.ok) return tooManyRequests(byIp.retryAfterSec);

  if (!email || !password || !name) {
    return NextResponse.json(
      { error: "Nome, email e senha são obrigatórios." },
      { status: 400 }
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "A senha deve ter no mínimo 8 caracteres." },
      { status: 400 }
    );
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: name } },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (!data.user) {
    return NextResponse.json({ error: "Erro ao criar usuário." }, { status: 500 });
  }

  // Supabase devolve o usuario existente sem erro quando o e-mail ja existe.
  if (data.user.identities && data.user.identities.length === 0) {
    return NextResponse.json(
      { error: "Este e-mail já está cadastrado." },
      { status: 409 }
    );
  }

  const userId = data.user.id;
  let clinicId: number | null = null;

  try {
    const { error: profilesError } = await supabaseAdmin
      .from("profiles")
      .insert({ user_id: userId, display_name: name });
    if (profilesError) throw new Error(`profiles: ${profilesError.message}`);

    const { error: adminError } = await supabaseAdmin
      .from("admin_profiles")
      .insert({ user_id: userId, role: "admin" });
    if (adminError) throw new Error(`admin_profiles: ${adminError.message}`);

    const { data: clinic, error: clinicError } = await supabaseAdmin
      .from("clinics")
      .insert({ name: clinicName })
      .select("id")
      .single();
    if (clinicError || !clinic) {
      throw new Error(`clinics: ${clinicError?.message ?? "sem id retornado"}`);
    }
    clinicId = Number(clinic.id);

    const { error: memberError } = await supabaseAdmin
      .from("clinic_members")
      .insert({ clinic_id: clinicId, user_id: userId, role: "owner", active: true });
    if (memberError) throw new Error(`clinic_members: ${memberError.message}`);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error("[auth/signup] falha ao criar tenant, revertendo:", reason);

    await supabaseAdmin.from("clinic_members").delete().eq("user_id", userId);
    if (clinicId !== null) {
      await supabaseAdmin.from("clinics").delete().eq("id", clinicId);
    }
    await supabaseAdmin.from("admin_profiles").delete().eq("user_id", userId);
    await supabaseAdmin.from("profiles").delete().eq("user_id", userId);
    await supabaseAdmin.auth.admin.deleteUser(userId);

    return NextResponse.json(
      { error: "Não foi possível completar o cadastro. Tente novamente." },
      { status: 500 }
    );
  }

  await recordAudit({
    actorId: userId,
    actorLabel: maskEmail(email),
    action: "auth.signup",
    entity: "users",
    entityId: userId,
    clinicId: clinicId ?? undefined,
    meta: { clinic: clinicName },
    ip: clientIp(request),
  });

  const response = NextResponse.json(
    { ok: true, userId, clinicId },
    { status: 201 }
  );
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    response.cookies.set(cookie.name, cookie.value, cookie);
  });

  return response;
}
