// ── Serviço de Controle de Planos e Limites ──────────────────────────────
// Centraliza toda a lógica de verificação de planos, limites e features.

import { supabaseAdmin } from "@/lib/supabase";
import { nowStr } from "@/lib/datetime";
import { getPlan, type PlanId, type FeatureId, type Plan } from "@/lib/plans";
import { BILLING_PATH, isActiveSubscriptionStatus } from "@/lib/subscription-access";

// ── Tipos ──────────────────────────────────────────────────────────────

export interface Subscription {
  id: string;
  clinic_id: number;
  plan_id: PlanId;
  status: SubscriptionStatus;
  lojou_customer_id: string;
  lojou_subscription_id: string;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
}

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  // Valores aceites pelo CHECK de subscriptions no Postgres:
  // ('none','trialing','active','past_due','cancelled','expired').
  | "cancelled"
  | "expired"
  | "canceled"
  | "unpaid"
  | "incomplete"
  | "none";

export interface ClinicUsage {
  clinic_id: number;
  period: string;
  whatsapp_conversations: number;
  ai_interactions: number;
  created_at: string;
  updated_at: string;
}

export interface UsageCheck {
  allowed: boolean;
  current: number;
  limit: number;
  remaining: number;
  percentage: number;
  planName: string;
  message?: string;
}

export interface LimitCheck {
  allowed: boolean;
  current: number;
  limit: number;
  remaining: number;
  planName: string;
  message: string;
}

// Resposta HTTP pronta para uma recusa por plano (402 Payment Required).
export interface PlanLimitFailure {
  status: number;
  body: {
    error: string;
    code: "PLAN_LIMIT";
    plan: string;
    current: number | null;
    limit: number | null;
    remaining: number | null;
  };
}

// ── Helpers ────────────────────────────────────────────────────────────

function getCurrentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

async function getClinicId(): Promise<number> {
  const { data, error } = await supabaseAdmin.from("clinics").select("id").limit(1);
  if (error) console.error("[plan-limits] Falha ao resolver a clínica:", error.message);
  return data?.[0]?.id ?? 1;
}

async function countRows(
  table: "professionals" | "clinic_members" | "units",
  clinicId: number
): Promise<number> {
  const query = supabaseAdmin
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", clinicId);

  const { count, error } =
    table === "professionals" ? await query.eq("status", "active") : await query.eq("active", true);

  if (error) {
    console.error(`[plan-limits] Falha ao contar ${table}:`, error.message);
    return 0;
  }
  return count ?? 0;
}

// ── Subscription ───────────────────────────────────────────────────────

export async function getSubscription(clinicId?: number): Promise<Subscription | null> {
  const cid = clinicId ?? (await getClinicId());
  const { data, error } = await supabaseAdmin
    .from("subscriptions")
    .select("*")
    .eq("clinic_id", cid)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    console.error("[plan-limits] Falha ao consultar a assinatura:", error.message);
    return null;
  }
  return (data?.[0]) ?? null;
}

export async function getActiveSubscription(clinicId?: number): Promise<Subscription | null> {
  const sub = await getSubscription(clinicId);
  if (!sub) return null;
  if (sub.status === "active" || sub.status === "trialing") return sub;
  return null;
}

export async function getClinicPlan(clinicId?: number): Promise<Plan> {
  const sub = await getActiveSubscription(clinicId);
  if (sub) {
    return getPlan(sub.plan_id);
  }
  // Sem assinatura ativa → retorna plano Start como fallback
  return getPlan("start");
}

export async function getSubscriptionStatus(clinicId?: number): Promise<SubscriptionStatus> {
  const sub = await getSubscription(clinicId);
  return sub?.status ?? "none";
}

// ── Gate de subscrição ativa ───────────────────────────────────────────
// Exige uma linha em subscriptions com estado ativo (active/trialing) para a
// clínica. Sem linha (nunca pagou) ou com estado pendente/cancelado →
// bloqueio 402. Usado pelo requireAuth (rotas operacionais) e pelo layout do
// app (redirect para a página de faturação).
export interface SubscriptionGateFailure {
  status: number;
  body: {
    error: string;
    code: "SUBSCRIPTION_REQUIRED";
    subscriptionStatus: SubscriptionStatus;
    redirectTo: string;
  };
}

// Corte de emergência do gate: SUBSCRIPTION_GATE_DISABLED=1/true/yes desliga
// o bloqueio (requireAuth, layout do app e /api/subscription/status) sem
// novo deploy — usado quando a BD ainda não tem assinaturas ativas gravadas.
export function subscriptionGateEnabled(): boolean {
  const flag = (process.env.SUBSCRIPTION_GATE_DISABLED ?? "").trim().toLowerCase();
  return flag !== "1" && flag !== "true" && flag !== "yes";
}

export async function guardActiveSubscription(
  clinicId?: number | null
): Promise<SubscriptionGateFailure | null> {
  if (!subscriptionGateEnabled()) return null;

  // Gate por clínica: sem clinic_id resolvido não há assinatura que
  // justifique acesso — nunca se consulta a "primeira clínica" da BD
  // (isso seria um fail-open multi-tenant). Responde 402 como uma clínica
  // sem linha em subscriptions.
  if (clinicId === undefined || clinicId === null) {
    return {
      status: 402,
      body: {
        error:
          "Assinatura inativa. Ative o seu plano para continuar a usar as funcionalidades da plataforma.",
        code: "SUBSCRIPTION_REQUIRED",
        subscriptionStatus: "none",
        redirectTo: BILLING_PATH,
      },
    };
  }

  const sub = await getSubscription(clinicId);
  if (sub && isActiveSubscriptionStatus(sub.status)) return null;

  return {
    status: 402,
    body: {
      error:
        "Assinatura inativa. Ative o seu plano para continuar a usar as funcionalidades da plataforma.",
      code: "SUBSCRIPTION_REQUIRED",
      subscriptionStatus: sub?.status ?? "none",
      redirectTo: BILLING_PATH,
    },
  };
}

export async function createSubscription(data: {
  clinic_id: number;
  plan_id: PlanId;
  lojou_customer_id?: string;
  lojou_subscription_id?: string;
  current_period_start?: string;
  current_period_end?: string;
}): Promise<Subscription> {
  const now = nowStr();
  const { data: row, error } = await supabaseAdmin
    .from("subscriptions")
    .insert({
      clinic_id: data.clinic_id,
      plan_id: data.plan_id,
      status: "active",
      lojou_customer_id: data.lojou_customer_id ?? "",
      lojou_subscription_id: data.lojou_subscription_id ?? "",
      current_period_start: data.current_period_start ?? now,
      current_period_end: data.current_period_end ?? now,
      cancel_at_period_end: false,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();

  if (error) {
    console.error("[plan-limits] Falha ao criar a assinatura:", error.message);
    throw new Error(`Falha ao criar a assinatura: ${error.message}`);
  }
  return row;
}

export async function updateSubscription(
  id: string,
  data: {
    status?: SubscriptionStatus;
    plan_id?: PlanId;
    lojou_customer_id?: string;
    lojou_subscription_id?: string;
    current_period_start?: string;
    current_period_end?: string;
    cancel_at_period_end?: boolean;
  }
): Promise<Subscription | null> {
  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("subscriptions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    console.error("[plan-limits] Falha ao consultar a assinatura:", fetchError.message);
    return null;
  }
  if (!existing) return null;

  const current = existing as unknown as Subscription;
  const { data: updated, error } = await supabaseAdmin
    .from("subscriptions")
    .update({
      status: data.status ?? current.status,
      plan_id: data.plan_id ?? current.plan_id,
      lojou_customer_id: data.lojou_customer_id ?? current.lojou_customer_id,
      lojou_subscription_id: data.lojou_subscription_id ?? current.lojou_subscription_id,
      current_period_start: data.current_period_start ?? current.current_period_start,
      current_period_end: data.current_period_end ?? current.current_period_end,
      cancel_at_period_end: data.cancel_at_period_end ?? current.cancel_at_period_end,
      updated_at: nowStr(),
    })
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) {
    console.error("[plan-limits] Falha ao actualizar a assinatura:", error.message);
    return null;
  }
  return (updated) ?? null;
}

// ── Feature Gating ─────────────────────────────────────────────────────

export async function hasFeature(clinicId: number | undefined, feature: FeatureId): Promise<boolean> {
  const plan = await getClinicPlan(clinicId);
  return plan.features.includes(feature);
}

export async function requireFeature(clinicId: number | undefined, feature: FeatureId): Promise<void> {
  if (!(await hasFeature(clinicId, feature))) {
    const plan = await getClinicPlan(clinicId);
    throw new PlanLimitError(
      `O recurso "${feature}" não está disponível no plano ${plan.name}. Faça upgrade para desbloquear.`,
      plan.name
    );
  }
}

// ── Limit Checks ───────────────────────────────────────────────────────

export class PlanLimitError extends Error {
  planName: string;
  constructor(message: string, planName: string) {
    super(message);
    this.name = "PlanLimitError";
    this.planName = planName;
  }
}

function buildLimitCheck(
  current: number,
  limit: number,
  planName: string,
  nouns: { limit: string; more: string; add: string }
): LimitCheck {
  const remaining = isFinite(limit) ? limit - current : Infinity;
  return {
    allowed: isFinite(limit) ? current < limit : true,
    current,
    limit,
    remaining,
    planName,
    message: isFinite(limit)
      ? current >= limit
        ? `Você atingiu o limite de ${limit} ${nouns.limit} do plano ${planName}. Faça upgrade para adicionar ${nouns.more}.`
        : `Pode adicionar ${remaining} ${nouns.add}.`
      : "Limite personalizado.",
  };
}

export function planLimitFailure(check: {
  allowed: boolean;
  current: number;
  limit: number;
  remaining: number;
  planName: string;
  message?: string;
}): PlanLimitFailure {
  return {
    status: 402,
    body: {
      error: check.message ?? `Limite do plano ${check.planName} atingido.`,
      code: "PLAN_LIMIT",
      plan: check.planName,
      current: check.current,
      limit: isFinite(check.limit) ? check.limit : null,
      remaining: isFinite(check.remaining) ? check.remaining : null,
    },
  };
}

export function planLimitFailureFromError(error: PlanLimitError): PlanLimitFailure {
  return {
    status: 402,
    body: {
      error: error.message,
      code: "PLAN_LIMIT",
      plan: error.planName,
      current: null,
      limit: null,
      remaining: null,
    },
  };
}

// Guards de rota: feature + quantidade num unico call. Devolvem null quando
// a acao e permitida e a resposta 402 quando o plano nao cobre.
async function guardWithFeature(
  clinicId: number | undefined,
  feature: FeatureId,
  check: () => Promise<LimitCheck>
): Promise<PlanLimitFailure | null> {
  try {
    await requireFeature(clinicId, feature);
  } catch (err) {
    if (err instanceof PlanLimitError) return planLimitFailureFromError(err);
    throw err;
  }
  const result = await check();
  return result.allowed ? null : planLimitFailure(result);
}

export function guardProfessionalLimit(clinicId?: number): Promise<PlanLimitFailure | null> {
  return guardWithFeature(clinicId, "professionals_management", () =>
    canAddProfessional(clinicId)
  );
}

export function guardAdminUserLimit(clinicId?: number): Promise<PlanLimitFailure | null> {
  return guardWithFeature(clinicId, "team_management", () => canAddAdminUser(clinicId));
}

export function guardUnitLimit(clinicId?: number): Promise<PlanLimitFailure | null> {
  return guardWithFeature(clinicId, "units_management", () => canAddUnit(clinicId));
}

export async function canAddProfessional(clinicId?: number): Promise<LimitCheck> {
  const cid = clinicId ?? (await getClinicId());
  const plan = await getClinicPlan(cid);
  const current = await countRows("professionals", cid);
  return buildLimitCheck(current, plan.limits.maxProfessionals, plan.name, {
    limit: "profissionais",
    more: "mais profissionais",
    add: "profissional(is)",
  });
}

export async function canAddAdminUser(clinicId?: number): Promise<LimitCheck> {
  const cid = clinicId ?? (await getClinicId());
  const plan = await getClinicPlan(cid);
  const current = await countRows("clinic_members", cid);
  return buildLimitCheck(current, plan.limits.maxAdminUsers, plan.name, {
    limit: "usuários administrativos",
    more: "mais",
    add: "usuário(s) administrativo(s)",
  });
}

export async function canAddUnit(clinicId?: number): Promise<LimitCheck> {
  const cid = clinicId ?? (await getClinicId());
  const plan = await getClinicPlan(cid);
  const current = await countRows("units", cid);
  return buildLimitCheck(current, plan.limits.maxUnits, plan.name, {
    limit: "unidade(s)",
    more: "mais",
    add: "unidade(s)",
  });
}

// ── WhatsApp Usage ─────────────────────────────────────────────────────

async function readUsage(
  clinicId: number,
  period: string
): Promise<{ whatsapp: number; ai: number; id: string | null }> {
  const { data, error } = await supabaseAdmin
    .from("usage")
    .select("id, whatsapp_conversations, ai_interactions")
    .eq("clinic_id", clinicId)
    .eq("period", period)
    .limit(1);

  if (error) {
    console.error("[plan-limits] Falha ao consultar o consumo:", error.message);
    return { whatsapp: 0, ai: 0, id: null };
  }
  const row = data?.[0];
  return {
    whatsapp: row?.whatsapp_conversations ?? 0,
    ai: row?.ai_interactions ?? 0,
    id: row?.id ?? null,
  };
}

async function writeUsage(
  clinicId: number,
  period: string,
  patch: Record<string, unknown>
): Promise<void> {
  const now = nowStr();
  const existing = await readUsage(clinicId, period);

  if (existing.id) {
    const { error } = await supabaseAdmin
      .from("usage")
      .update({ ...patch, updated_at: now })
      .eq("id", existing.id);
    if (error) console.error("[plan-limits] Falha ao actualizar o consumo:", error.message);
    return;
  }

  const { error } = await supabaseAdmin.from("usage").insert({
    clinic_id: clinicId,
    period,
    whatsapp_conversations: 0,
    ai_interactions: 0,
    ...patch,
    created_at: now,
    updated_at: now,
  });
  if (error) console.error("[plan-limits] Falha ao criar o consumo:", error.message);
}

// Escrita atômica dos contadores do período via RPC
// (increment_usage_counters, migration 20261006000001). O Postgres soma em
// um único UPDATE ... ON CONFLICT DO UPDATE, por isso duas mensagens
// simultâneas não se sobrescrevem (o read-modify-write antigo perdia 1).
// Devolve false quando a função ainda não existe no banco ou devolve algo
// inesperado — nesse caso o chamador cai no caminho legado.
async function incrementUsageAtomic(
  clinicId: number,
  period: string,
  whatsapp: number,
  ai: number
): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin.rpc("increment_usage_counters", {
      p_clinic_id: clinicId,
      p_period: period,
      p_whatsapp: whatsapp,
      p_ai: ai,
    });
    if (error) {
      console.error("[plan-limits] RPC de contadores indisponível:", error.message);
      return false;
    }
    const row = data as { ai_interactions?: number } | null;
    return Boolean(
      row && typeof row === "object" && !Array.isArray(row) && "ai_interactions" in row
    );
  } catch (err) {
    console.error(
      "[plan-limits] Falha ao incrementar contadores de forma atómica:",
      err instanceof Error ? err.message : err
    );
    return false;
  }
}

export async function getWhatsappUsage(clinicId?: number): Promise<UsageCheck> {
  const cid = clinicId ?? (await getClinicId());
  const plan = await getClinicPlan(cid);
  const period = getCurrentPeriod();
  const limit = plan.limits.maxWhatsappConversations;
  const current = (await readUsage(cid, period)).whatsapp;

  const remaining = isFinite(limit) ? Math.max(0, limit - current) : Infinity;

  return {
    allowed: isFinite(limit) ? current < limit : true,
    current,
    limit,
    remaining,
    percentage: isFinite(limit) ? Math.min(100, Math.round((current / limit) * 100)) : 0,
    planName: plan.name,
    message: isFinite(limit) && current >= limit
      ? `Limite de ${limit} conversas WhatsApp do plano ${plan.name} atingido.`
      : undefined,
  };
}

export async function canSendWhatsapp(clinicId?: number): Promise<boolean> {
  return (await getWhatsappUsage(clinicId)).allowed;
}

export async function incrementWhatsappUsage(clinicId?: number, amount = 1): Promise<void> {
  const cid = clinicId ?? (await getClinicId());
  const period = getCurrentPeriod();
  if (await incrementUsageAtomic(cid, period, amount, 0)) return;
  const current = (await readUsage(cid, period)).whatsapp;
  await writeUsage(cid, period, { whatsapp_conversations: current + amount });
}

// ── AI Usage ───────────────────────────────────────────────────────────

export async function getAiUsage(clinicId?: number): Promise<UsageCheck> {
  const cid = clinicId ?? (await getClinicId());
  const plan = await getClinicPlan(cid);
  const period = getCurrentPeriod();
  const limit = plan.limits.maxAiInteractions;
  const current = (await readUsage(cid, period)).ai;

  const remaining = isFinite(limit) ? Math.max(0, limit - current) : Infinity;

  return {
    allowed: isFinite(limit) ? current < limit : true,
    current,
    limit,
    remaining,
    percentage: isFinite(limit) ? Math.min(100, Math.round((current / limit) * 100)) : 0,
    planName: plan.name,
    message: isFinite(limit) && current >= limit
      ? `Limite de ${limit} interações IA do plano ${plan.name} atingido.`
      : undefined,
  };
}

export async function canUseAI(clinicId?: number): Promise<boolean> {
  return (await getAiUsage(clinicId)).allowed;
}

export async function canUseAiInteraction(clinicId?: number): Promise<boolean> {
  return canUseAI(clinicId);
}

export async function incrementAiUsage(clinicId?: number, amount = 1): Promise<void> {
  const cid = clinicId ?? (await getClinicId());
  const period = getCurrentPeriod();
  if (await incrementUsageAtomic(cid, period, 0, amount)) return;
  const current = (await readUsage(cid, period)).ai;
  await writeUsage(cid, period, { ai_interactions: current + amount });
}

// ── Conversas ativas ───────────────────────────────────────────────────

// Conta apenas as conversas da própria clínica (coluna clinic_id presente
// desde a migration 20260911000002) contra o teto do plano.
export async function canCreateConversation(clinicId?: number): Promise<LimitCheck> {
  const cid = clinicId ?? (await getClinicId());
  const plan = await getClinicPlan(cid);
  const { count, error } = await supabaseAdmin
    .from("conversations")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", cid);

  if (error) console.error("[plan-limits] Falha ao contar conversas:", error.message);

  return buildLimitCheck(count ?? 0, plan.limits.maxConversations, plan.name, {
    limit: "conversas ativas",
    more: "conversas ativas",
    add: "conversa(s)",
  });
}

// ── Dashboard Usage ────────────────────────────────────────────────────

export async function getUsageDashboard(clinicId?: number) {
  const cid = clinicId ?? (await getClinicId());
  const plan = await getClinicPlan(cid);
  const [whatsapp, ai, professionals, adminUsers, units, conversations] = await Promise.all([
    getWhatsappUsage(cid),
    getAiUsage(cid),
    canAddProfessional(cid),
    canAddAdminUser(cid),
    canAddUnit(cid),
    canCreateConversation(cid),
  ]);

  return {
    plan: {
      id: plan.id,
      name: plan.name,
      price: plan.price,
      currency: plan.currency,
    },
    professionals: {
      current: professionals.current,
      limit: professionals.limit,
      percentage: isFinite(professionals.limit)
        ? Math.min(100, Math.round((professionals.current / professionals.limit) * 100))
        : 0,
    },
    adminUsers: {
      current: adminUsers.current,
      limit: adminUsers.limit,
      percentage: isFinite(adminUsers.limit)
        ? Math.min(100, Math.round((adminUsers.current / adminUsers.limit) * 100))
        : 0,
    },
    units: {
      current: units.current,
      limit: units.limit,
      percentage: isFinite(units.limit)
        ? Math.min(100, Math.round((units.current / units.limit) * 100))
        : 0,
    },
    whatsapp: {
      current: whatsapp.current,
      limit: whatsapp.limit,
      percentage: whatsapp.percentage,
    },
    ai: {
      current: ai.current,
      limit: ai.limit,
      percentage: ai.percentage,
    },
    conversations: {
      current: conversations.current,
      limit: conversations.limit,
      percentage: isFinite(conversations.limit)
        ? Math.min(100, Math.round((conversations.current / conversations.limit) * 100))
        : 0,
    },
  };
}

// ── Downgrade Check ────────────────────────────────────────────────────

export async function canDowngradeTo(
  targetPlanId: PlanId,
  clinicId?: number
): Promise<{ allowed: boolean; issues: string[] }> {
  const cid = clinicId ?? (await getClinicId());
  const targetPlan = getPlan(targetPlanId);
  const issues: string[] = [];

  const [professionalCheck, adminCheck, unitsCheck] = await Promise.all([
    canAddProfessional(cid),
    canAddAdminUser(cid),
    canAddUnit(cid),
  ]);

  if (professionalCheck.current > targetPlan.limits.maxProfessionals && isFinite(targetPlan.limits.maxProfessionals)) {
    issues.push(
      `Sua clínica possui ${professionalCheck.current} profissionais, mas o plano ${targetPlan.name} permite apenas ${targetPlan.limits.maxProfessionals}. Reduza a quantidade de profissionais ativos ou escolha outro plano.`
    );
  }

  if (adminCheck.current > targetPlan.limits.maxAdminUsers && isFinite(targetPlan.limits.maxAdminUsers)) {
    issues.push(
      `Sua clínica possui ${adminCheck.current} usuários administrativos, mas o plano ${targetPlan.name} permite apenas ${targetPlan.limits.maxAdminUsers}.`
    );
  }

  if (unitsCheck.current > targetPlan.limits.maxUnits && isFinite(targetPlan.limits.maxUnits)) {
    issues.push(
      `Sua clínica possui ${unitsCheck.current} unidades, mas o plano ${targetPlan.name} permite apenas ${targetPlan.limits.maxUnits}.`
    );
  }

  return { allowed: issues.length === 0, issues };
}
