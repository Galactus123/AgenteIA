import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function requireAuth(request: NextRequest): Promise<NextResponse | null> {
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  return null;
}

export async function getUser(request: NextRequest) {
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

  return user;
}

// Clínica do utilizador autenticado (clinic_members ativo). Sem vínculo →
// null: o chamador decide o fallback (nunca é o "limit(1)" silencioso).
// Lê via service role apenas a associação do próprio user_id — não expõe
// outras clínicas e não depende do RLS de clinic_members.
export async function resolveClinicId(request: NextRequest): Promise<number | null> {
  const user = await getUser(request);
  if (!user) return null;

  const { data, error } = await supabaseAdmin
    .from("clinic_members")
    .select("clinic_id")
    .eq("user_id", user.id)
    .eq("active", true)
    .order("clinic_id", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[auth] Falha ao resolver a clínica do utilizador:", error.message);
    return null;
  }
  const clinicId = (data as { clinic_id?: number | string } | null)?.clinic_id;
  return clinicId === undefined || clinicId === null ? null : Number(clinicId);
}

export async function requireInternalAuth(request: NextRequest): Promise<NextResponse | null> {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  // INTERNAL_API_TOKEN (uso interno) e CRON_SECRET (injecao automatica da
  // Vercel Cron e, no nosso caso, tambem o token do pg_cron do Supabase).
  const accepted = [process.env.INTERNAL_API_TOKEN, process.env.CRON_SECRET].filter(
    (value): value is string => Boolean(value)
  );

  if (accepted.length === 0) {
    // Sem token configurado a rota interna fica FECHADA tambem em dev:
    // bypass silencioso aqui virava porta de prod no ambiente errado.
    console.error(
      "[auth] CRON_SECRET/INTERNAL_API_TOKEN nao configurado — requisicao interna rejeitada" +
        (process.env.VERCEL ? " (producao)" : " (dev)")
    );
    return NextResponse.json(
      { error: "Token interno nao configurado. Defina CRON_SECRET ou INTERNAL_API_TOKEN." },
      { status: 500 }
    );
  }

  if (!token || !accepted.includes(token)) {
    return NextResponse.json({ error: "Token invalido." }, { status: 401 });
  }
  return null;
}
