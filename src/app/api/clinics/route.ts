import { NextRequest, NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import {
  getUser,
  preferredClinicIdFromRequest,
  requireAuth,
  resolveClinicIdByUserId,
} from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { auditRequest } from "@/lib/services/audit";
import { isActiveSubscriptionStatus } from "@/lib/subscription-access";
import type { ClinicListItem, ClinicsResponse } from "@/lib/types";

// ── Multi-clínica (Fase 1) ──────────────────────────────────────────────────
// GET   /api/clinics        → vínculos ativos do utilizador + clínica atual
// POST  /api/clinics        → cria uma clínica (o utilizador vira owner)
// PATCH /api/clinics/active → troca a clínica ativa (rota própria)
//
// Todas ficam isentas do gate de assinatura (SUBSCRIPTION_EXEMPT_PREFIXES):
// listar/trocar é meta-operação da conta — sem ela, quem muda para uma
// clínica sem assinatura não conseguia voltar à anterior. O gate por clínica
// segue valer para TODA a restante API operacional.
//
// O corpo do pedido NUNCA escopa leituras: a lista usa o próprio user_id e
// a troca (rota irmã) valida o vínculo em clinic_members antes de agir.

// clinic_members + clínica embutida (FK clinic_id → clinics) + assinaturas
// da clínica embutidas (FK subscriptions.clinic_id → clinics).
interface MembershipRow {
  clinic_id: number | string;
  role: string | null;
  clinics: {
    id: number | string;
    name: string | null;
    subscriptions: { status: string | null }[] | null;
  } | null;
}

// Auth + utilizador; devolve NextResponse de erro ou o utilizador da sessão.
async function requireUser(
  request: NextRequest
): Promise<NextResponse | { user: User }> {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const user = await getUser(request);
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  return { user };
}

export async function GET(request: NextRequest) {
  const session = await requireUser(request);
  if (session instanceof NextResponse) return session;
  const { user } = session;

  const currentClinicId = await resolveClinicIdByUserId(
    user.id,
    preferredClinicIdFromRequest(request)
  );

  const { data, error } = await supabaseAdmin
    .from("clinic_members")
    .select("clinic_id, role, clinics(id, name, subscriptions(status))")
    .eq("user_id", user.id)
    .eq("active", true)
    .order("clinic_id", { ascending: true });

  if (error) {
    console.error("[clinics] Falha ao listar as clínicas do utilizador:", error.message);
    return NextResponse.json(
      { error: "Não foi possível listar as clínicas." },
      { status: 500 }
    );
  }

  const clinics: ClinicListItem[] = ((data ?? []) as unknown as MembershipRow[]).map(
    (row) => {
      const id = Number(row.clinic_id);
      const subscriptions = row.clinics?.subscriptions ?? [];
      return {
        id,
        name: row.clinics?.name?.trim() || `Clínica #${id}`,
        role: row.role ?? "member",
        hasActiveSubscription: subscriptions.some((s) =>
          isActiveSubscriptionStatus(s.status)
        ),
        isCurrent: id === currentClinicId,
      };
    }
  );

  const payload: ClinicsResponse = { clinics, currentClinicId };
  return NextResponse.json(payload);
}

export async function POST(request: NextRequest) {
  const session = await requireUser(request);
  if (session instanceof NextResponse) return session;
  const { user } = session;

  // Anti-abuso: criar tenant é caro e ainda não existe limite de planos
  // para clínicas (maxClinics é Fase 2) — o teto por utilizador segura a
  // porta até lá (10/h, no espírito do signup: 10/h por IP).
  const limit = rateLimit(`clinics:create:${user.id}`, 10, 60 * 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSec);

  const body = await request.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  if (!name) {
    return NextResponse.json(
      { error: "O nome da clínica é obrigatório." },
      { status: 400 }
    );
  }
  if (name.length > 120) {
    return NextResponse.json(
      { error: "O nome da clínica pode ter no máximo 120 caracteres." },
      { status: 400 }
    );
  }

  // Mesmo padrão do signup (clinics → clinic_members, sem transação no
  // PostgREST): em falha, desfaz o que já foi criado para nunca deixar uma
  // clínica órfã sem owner.
  const { data: clinic, error: clinicError } = await supabaseAdmin
    .from("clinics")
    .insert({ name })
    .select("id")
    .single();

  if (clinicError || !clinic) {
    console.error("[clinics] Falha ao criar a clínica:", clinicError?.message ?? "sem id");
    return NextResponse.json(
      { error: "Não foi possível criar a clínica. Tente novamente." },
      { status: 500 }
    );
  }
  const clinicId = Number(clinic.id);

  const { error: memberError } = await supabaseAdmin.from("clinic_members").insert({
    clinic_id: clinicId,
    user_id: user.id,
    role: "owner",
    active: true,
  });

  if (memberError) {
    console.error(
      "[clinics] Falha ao criar o vínculo owner, revertendo:",
      memberError.message
    );
    await supabaseAdmin.from("clinics").delete().eq("id", clinicId);
    return NextResponse.json(
      { error: "Não foi possível criar a clínica. Tente novamente." },
      { status: 500 }
    );
  }

  // Auditoria best-effort: nome da clínica não é PII (telefone/endereço
  // continuam fora da trilha, como no PUT /api/clinica).
  await auditRequest(request, {
    action: "clinic.create",
    entity: "clinics",
    entityId: clinicId,
    clinicId,
    user,
    meta: { name },
  });

  const clinicItem: ClinicListItem = {
    id: clinicId,
    name,
    role: "owner",
    hasActiveSubscription: false,
    isCurrent: false,
  };
  return NextResponse.json({ clinic: clinicItem }, { status: 201 });
}
