import { NextRequest, NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import {
  ACTIVE_CLINIC_COOKIE,
  activeClinicCookieOptions,
  getUser,
  parseActiveClinicId,
  preferredClinicIdFromRequest,
  requireAuth,
  resolveClinicIdByUserId,
} from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase";
import { auditRequest } from "@/lib/services/audit";

// ── Multi-clínica (Fase 1): troca da clínica ativa ──────────────────────────
// PATCH /api/clinics/active { clinicId }
//
// Isenta do gate de assinatura (/api/clinics): trocar É o mecanismo de
// saída de uma clínica sem assinatura ativa.
//
// Segurança, nesta ordem:
//   1. sessão válida (requireAuth);
//   2. clinicId parseado como inteiro positivo (dado não confiável);
//   3. vínculo ATIVO exigido em clinic_members — só o próprio utilizador
//      pode ativar uma clínica à qual pertence (403 caso contrário);
//   4. gravação em user_active_clinic (persistência entre dispositivos) e
//      cookie sd_active_clinic (httpOnly) — ambas as fontes são relidas e
//      REVALIDADAS contra clinic_members em cada resolução de clínica.
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

export async function PATCH(request: NextRequest) {
  const session = await requireUser(request);
  if (session instanceof NextResponse) return session;
  const { user } = session;

  const body = await request.json().catch(() => null);
  const clinicId = parseActiveClinicId(
    body?.clinicId === undefined || body?.clinicId === null
      ? null
      : String(body.clinicId)
  );
  if (clinicId === null) {
    return NextResponse.json({ error: "Clínica inválida." }, { status: 400 });
  }

  const { data: member, error: memberError } = await supabaseAdmin
    .from("clinic_members")
    .select("clinic_id")
    .eq("user_id", user.id)
    .eq("clinic_id", clinicId)
    .eq("active", true)
    .maybeSingle();

  if (memberError) {
    console.error("[clinics/active] Falha ao validar o vínculo:", memberError.message);
    return NextResponse.json(
      { error: "Não foi possível verificar a clínica. Tente novamente." },
      { status: 500 }
    );
  }
  if (!member) {
    return NextResponse.json(
      { error: "Você não tem acesso a esta clínica." },
      { status: 403 }
    );
  }

  const previousClinicId = await resolveClinicIdByUserId(
    user.id,
    preferredClinicIdFromRequest(request)
  );

  // Persistência entre dispositivos: se a tabela ainda não existir (não
  // migrada), o log regista e a troca continua via cookie — degradação
  // explícita, nunca um 500 a impedir o utilizador de sair da clínica.
  const { error: upsertError } = await supabaseAdmin.from("user_active_clinic").upsert(
    { user_id: user.id, clinic_id: clinicId, updated_at: new Date().toISOString() },
    { onConflict: "user_id" }
  );
  if (upsertError) {
    console.error(
      "[clinics/active] Falha ao guardar a preferência no servidor:",
      upsertError.message
    );
  }

  await auditRequest(request, {
    action: "clinic.switch",
    entity: "clinics",
    entityId: clinicId,
    clinicId,
    user,
    meta: { from: previousClinicId },
  });

  const response = NextResponse.json({ ok: true, clinicId });
  response.cookies.set(
    ACTIVE_CLINIC_COOKIE,
    String(clinicId),
    activeClinicCookieOptions()
  );
  return response;
}
