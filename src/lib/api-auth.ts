import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase";
import { guardActiveSubscription } from "@/lib/services/plan-limits";

// Rotas de API que continuam acessíveis sem subscrição ativa: autenticação,
// estado/faturação da própria assinatura e health. Tudo o resto (funcionali-
// dads operacionais) passa pelo gate de assinatura ativa em requireAuth.
// /api/clinics fica de fora de propósito (Fase 1 multi-clínica): listar e
// trocar de clínica é meta-operação como a faturação — sem ela, quem muda
// para uma clínica sem assinatura ficaria preso nela sem conseguir voltar.
const SUBSCRIPTION_EXEMPT_PREFIXES = [
  "/api/auth",
  "/api/subscription",
  "/api/health",
  "/api/clinics",
];

// Rotas cuja LEITURA (GET) serve apenas para preencher formulários e seleções
// do painel (catálogo estático, sem dados de pacientes). Ficam isentas do gate
// para que um utilizador em modo de visualização ainda veja as opções
// disponíveis — a escrita continua bloqueada porque não é GET.
const SUBSCRIPTION_EXEMPT_READ_PREFIXES = ["/api/especialidades"];

export function isSubscriptionExemptApi(pathname: string): boolean {
  return SUBSCRIPTION_EXEMPT_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function isSubscriptionExemptReadApi(pathname: string): boolean {
  return SUBSCRIPTION_EXEMPT_READ_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

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

  // Gate de subscrição: clínica sem linha ativa em subscriptions não acede
  // às rotas operacionais (a de faturação é isenta para poder cobrar).
  // Sem vínculo em clinic_members o gate responde 402 (nunca consulta a
  // "primeira clínica" da base — seria um fail-open multi-tenant).
  // Leituras de catálogo (GET em /api/especialidades) ficam de fora: servem
  // só para popular <select> do form e não expõem dados de pacientes.
  const exempt =
    isSubscriptionExemptApi(request.nextUrl.pathname) ||
    (request.method === "GET" &&
      isSubscriptionExemptReadApi(request.nextUrl.pathname));
  if (!exempt) {
    const clinicId = await resolveClinicIdByUserId(
      user.id,
      preferredClinicIdFromRequest(request)
    );
    const gate = await guardActiveSubscription(clinicId);
    if (gate) {
      return NextResponse.json(gate.body, { status: gate.status });
    }
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

// ── Multi-clínica (Fase 1): clínica ativa do utilizador ─────────────────────
// Duas fontes de preferência, na ordem lida por resolveClinicIdByUserId:
//   1. cookie `sd_active_clinic` (httpOnly, por dispositivo) — rápido;
//   2. user_active_clinic (tabela, persistente entre dispositivos).
// Qualquer preferência é VALIDADA contra clinic_members do próprio user_id
// antes de valer: apontamento sem vínculo ativo é ignorado (nunca trocado
// por dados de outro tenant) e só então cai no legado — menor clinic_id
// ativo do utilizador, que continua a ser o comportamento histórico.
export const ACTIVE_CLINIC_COOKIE = "sd_active_clinic";

const ACTIVE_CLINIC_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 ano

// Aceita só um inteiro positivo curto: o valor vem do cookie/request e é
// sempre tratado como dado não confiável (nunca chega à query sem validar).
export function parseActiveClinicId(raw: string | null | undefined): number | null {
  if (!raw || !/^\d{1,10}$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

// Preferência do cookie no pedido (rotas de API — leitura síncrona do
// NextRequest, sem depender do escopo de request do next/headers).
export function preferredClinicIdFromRequest(request: NextRequest): number | null {
  return parseActiveClinicId(request.cookies.get(ACTIVE_CLINIC_COOKIE)?.value ?? null);
}

// Preferência do cookie em Server Components/ layouts (páginas do painel).
// Fora de request scope (build/teste) não há cookie: devolve null e a
// resolução segue para a tabela/fallback — nunca lança.
export async function preferredClinicIdFromCookieStore(): Promise<number | null> {
  try {
    const store = await cookies();
    return parseActiveClinicId(store.get(ACTIVE_CLINIC_COOKIE)?.value ?? null);
  } catch {
    return null;
  }
}

// Opções do cookie da clínica ativa (escritas só em Route Handler).
export function activeClinicCookieOptions(): {
  httpOnly: boolean;
  sameSite: "lax";
  secure: boolean;
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ACTIVE_CLINIC_COOKIE_MAX_AGE,
  };
}

// Vínculo ativo do utilizador numa clínica específica (service role: só a
// associação do próprio user_id, sem tocar no RLS de clinic_members).
// Erro de leitura → false (a resolução cai para o fallback, que também
// valida — nunca resulta em clínica à qual o user não pertence).
async function hasActiveMembership(userId: string, clinicId: number): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("clinic_members")
    .select("clinic_id")
    .eq("user_id", userId)
    .eq("clinic_id", clinicId)
    .eq("active", true)
    .maybeSingle();

  if (error) {
    console.error("[auth] Falha ao validar o vínculo de clínica:", error.message);
    return false;
  }
  return Boolean(data);
}

// Preferência persistida no servidor (user_active_clinic — 20261019000001).
// Tabela ainda não migrada (PGRST205) não é erro de segurança: silencia e
// devolve null para usar o fallback. Códigos demás ficam registados.
async function storedActiveClinicId(userId: string): Promise<number | null> {
  const { data, error } = await supabaseAdmin
    .from("user_active_clinic")
    .select("clinic_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (error.code !== "PGRST205") {
      console.error("[auth] Falha ao ler a clínica ativa guardada:", error.message);
    }
    return null;
  }
  const raw = (data as { clinic_id?: number | string } | null)?.clinic_id;
  return raw === undefined || raw === null ? null : parseActiveClinicId(String(raw));
}

// Clínica do utilizador autenticado. Sem vínculo → null: o chamador decide
// o fallback (nunca é um "primeira clínica da base" silencioso).
// `preferredClinicId` é a preferência explícita do cookie do pedido; as
// opções 2/3 (tabela persistida e menor id) correm dentro da função.
export async function resolveClinicIdByUserId(
  userId: string,
  preferredClinicId?: number | null
): Promise<number | null> {
  // 1. Cookie do pedido: só vale com vínculo ativo nesta clínica.
  if (preferredClinicId !== null && preferredClinicId !== undefined) {
    if (await hasActiveMembership(userId, preferredClinicId)) {
      return preferredClinicId;
    }
  }

  // 2. Preferência persistida no servidor (mesma validação de vínculo).
  const stored = await storedActiveClinicId(userId);
  if (stored !== null && (await hasActiveMembership(userId, stored))) {
    return stored;
  }

  // 3. Legado: menor clinic_id ativo do utilizador (comportamento anterior
  //    à multi-clínica — continuam a ser sempre clínicas do próprio user).
  const { data, error } = await supabaseAdmin
    .from("clinic_members")
    .select("clinic_id")
    .eq("user_id", userId)
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

export async function resolveClinicId(request: NextRequest): Promise<number | null> {
  const user = await getUser(request);
  if (!user) return null;

  return resolveClinicIdByUserId(user.id, preferredClinicIdFromRequest(request));
}

// ── Contexto de clínica para rotas operacionais ─────────────────────────────
// Autentica (inclui o gate de assinatura) e resolve a clínica do próprio
// utilizador — fail-closed: sessão ausente → 401, sessão válida sem vínculo
// ativo em clinic_members → 403. O clinic_id vem SEMPRE do servidor: nunca
// do corpo do pedido; do cookie sd_active_clinic só depois de validado em
// clinic_members (valor sem vínculo é ignorado) e nunca cai para a
// "primeira clínica" da base de dados.
export interface ClinicContext {
  user: User;
  clinicId: number;
}

export async function requireClinic(
  request: NextRequest
): Promise<NextResponse | ClinicContext> {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const user = await getUser(request);
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const clinicId = await resolveClinicIdByUserId(
    user.id,
    preferredClinicIdFromRequest(request)
  );
  if (clinicId === null) {
    return NextResponse.json(
      { error: "Sem clínica vinculada a esta conta." },
      { status: 403 }
    );
  }

  return { user, clinicId };
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
