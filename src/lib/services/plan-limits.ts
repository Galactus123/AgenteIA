// ── Serviço de Controle de Planos e Limites ──────────────────────────────
// Centraliza toda a lógica de verificação de planos, limites e features.

import { db } from "@/lib/db";
import { nowStr } from "@/lib/datetime";
import { getPlan, type PlanId, type FeatureId, type Plan, type PlanLimits } from "@/lib/plans";
import type { Clinic } from "@/lib/types";

// ── Tipos ──────────────────────────────────────────────────────────────

export interface Subscription {
  id: number;
  clinic_id: number;
  plan_id: PlanId;
  status: SubscriptionStatus;
  lojou_customer_id: string;
  lojou_subscription_id: string;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: number;
  created_at: string;
  updated_at: string;
}

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
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

// ── Helpers ────────────────────────────────────────────────────────────

function getCurrentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getClinicId(): number {
  const clinic = db.prepare("SELECT id FROM clinics LIMIT 1").get() as { id: number } | undefined;
  return clinic?.id ?? 1;
}

// ── Subscription ───────────────────────────────────────────────────────

export function getSubscription(clinicId?: number): Subscription | null {
  const cid = clinicId ?? getClinicId();
  const row = db.prepare("SELECT * FROM subscriptions WHERE clinic_id = ? ORDER BY id DESC LIMIT 1").get(cid);
  return (row as Subscription | undefined) ?? null;
}

export function getActiveSubscription(clinicId?: number): Subscription | null {
  const sub = getSubscription(clinicId);
  if (!sub) return null;
  if (sub.status === "active" || sub.status === "trialing") return sub;
  return null;
}

export function getClinicPlan(clinicId?: number): Plan {
  const sub = getActiveSubscription(clinicId);
  if (sub) {
    return getPlan(sub.plan_id);
  }
  // Sem assinatura ativa → retorna plano Start como fallback
  return getPlan("start");
}

export function getSubscriptionStatus(clinicId?: number): SubscriptionStatus {
  const sub = getSubscription(clinicId);
  return sub?.status ?? "none";
}

export function createSubscription(data: {
  clinic_id: number;
  plan_id: PlanId;
  lojou_customer_id?: string;
  lojou_subscription_id?: string;
  current_period_start?: string;
  current_period_end?: string;
}): Subscription {
  const now = nowStr();
  const result = db
    .prepare(
      `INSERT INTO subscriptions (clinic_id, plan_id, status, lojou_customer_id, lojou_subscription_id, current_period_start, current_period_end, cancel_at_period_end, created_at, updated_at)
       VALUES (?, ?, 'active', ?, ?, ?, ?, 0, ?, ?)`
    )
    .run(
      data.clinic_id,
      data.plan_id,
      data.lojou_customer_id ?? "",
      data.lojou_subscription_id ?? "",
      data.current_period_start ?? now,
      data.current_period_end ?? now,
      now,
      now
    );
  return db.prepare("SELECT * FROM subscriptions WHERE id = ?").get(Number(result.lastInsertRowid)) as unknown as Subscription;
}

export function updateSubscription(
  id: number,
  data: {
    status?: SubscriptionStatus;
    plan_id?: PlanId;
    lojou_customer_id?: string;
    lojou_subscription_id?: string;
    current_period_start?: string;
    current_period_end?: string;
    cancel_at_period_end?: number;
  }
): Subscription | null {
  const existing = db.prepare("SELECT * FROM subscriptions WHERE id = ?").get(id) as Subscription | undefined;
  if (!existing) return null;

  const now = nowStr();
  db.prepare(
    `UPDATE subscriptions SET
      status = ?,
      plan_id = ?,
      lojou_customer_id = ?,
      lojou_subscription_id = ?,
      current_period_start = ?,
      current_period_end = ?,
      cancel_at_period_end = ?,
      updated_at = ?
    WHERE id = ?`
  ).run(
    data.status ?? existing.status,
    data.plan_id ?? existing.plan_id,
    data.lojou_customer_id ?? existing.lojou_customer_id,
    data.lojou_subscription_id ?? existing.lojou_subscription_id,
    data.current_period_start ?? existing.current_period_start,
    data.current_period_end ?? existing.current_period_end,
    data.cancel_at_period_end ?? existing.cancel_at_period_end,
    now,
    id
  );
  return db.prepare("SELECT * FROM subscriptions WHERE id = ?").get(id) as unknown as Subscription;
}

// ── Feature Gating ─────────────────────────────────────────────────────

export function hasFeature(clinicId: number | undefined, feature: FeatureId): boolean {
  const plan = getClinicPlan(clinicId);
  return plan.features.includes(feature);
}

export function requireFeature(clinicId: number | undefined, feature: FeatureId): void {
  if (!hasFeature(clinicId, feature)) {
    const plan = getClinicPlan(clinicId);
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

function countActiveDoctors(clinicId: number): number {
  const row = db.prepare("SELECT COUNT(*) as c FROM doctors WHERE clinic_id = ? AND status = 'active'").get(clinicId) as { c: number };
  return row.c;
}

function countActiveAdminUsers(clinicId: number): number {
  const row = db.prepare("SELECT COUNT(*) as c FROM clinic_members WHERE clinic_id = ? AND active = 1").get(clinicId) as { c: number } | undefined;
  return row?.c ?? 0;
}

function countUnits(clinicId: number): number {
  const row = db.prepare("SELECT COUNT(*) as c FROM clinic_units WHERE clinic_id = ? AND active = 1").get(clinicId) as { c: number } | undefined;
  return row?.c ?? 0;
}

export function canAddProfessional(clinicId?: number): LimitCheck {
  const cid = clinicId ?? getClinicId();
  const plan = getClinicPlan(cid);
  const current = countActiveDoctors(cid);
  const limit = plan.limits.maxProfessionals;
  const remaining = isFinite(limit) ? limit - current : Infinity;

  return {
    allowed: isFinite(limit) ? current < limit : true,
    current,
    limit,
    remaining,
    planName: plan.name,
    message: isFinite(limit)
      ? current >= limit
        ? `Você atingiu o limite de ${limit} profissionais do plano ${plan.name}. Faça upgrade para adicionar mais profissionais.`
        : `Pode adicionar ${remaining} profissional(is).`
      : "Limite personalizado.",
  };
}

export function canAddAdminUser(clinicId?: number): LimitCheck {
  const cid = clinicId ?? getClinicId();
  const plan = getClinicPlan(cid);
  const current = countActiveAdminUsers(cid);
  const limit = plan.limits.maxAdminUsers;
  const remaining = isFinite(limit) ? limit - current : Infinity;

  return {
    allowed: isFinite(limit) ? current < limit : true,
    current,
    limit,
    remaining,
    planName: plan.name,
    message: isFinite(limit)
      ? current >= limit
        ? `Você atingiu o limite de ${limit} usuários administrativos do plano ${plan.name}. Faça upgrade para adicionar mais.`
        : `Pode adicionar ${remaining} usuário(s) administrativo(s).`
      : "Limite personalizado.",
  };
}

export function canAddUnit(clinicId?: number): LimitCheck {
  const cid = clinicId ?? getClinicId();
  const plan = getClinicPlan(cid);
  const current = countUnits(cid);
  const limit = plan.limits.maxUnits;
  const remaining = isFinite(limit) ? limit - current : Infinity;

  return {
    allowed: isFinite(limit) ? current < limit : true,
    current,
    limit,
    remaining,
    planName: plan.name,
    message: isFinite(limit)
      ? current >= limit
        ? `Você atingiu o limite de ${limit} unidade(s) do plano ${plan.name}. Faça upgrade para adicionar mais.`
        : `Pode adicionar ${remaining} unidade(s).`
      : "Limite personalizado.",
  };
}

// ── WhatsApp Usage ─────────────────────────────────────────────────────

export function getWhatsappUsage(clinicId?: number): UsageCheck {
  const cid = clinicId ?? getClinicId();
  const plan = getClinicPlan(cid);
  const period = getCurrentPeriod();
  const limit = plan.limits.maxWhatsappConversations;

  const row = db
    .prepare("SELECT whatsapp_conversations FROM usage WHERE clinic_id = ? AND period = ?")
    .get(cid, period) as { whatsapp_conversations: number } | undefined;
  const current = row?.whatsapp_conversations ?? 0;

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

export function canSendWhatsapp(clinicId?: number): boolean {
  return getWhatsappUsage(clinicId).allowed;
}

export function incrementWhatsappUsage(clinicId?: number, amount = 1): void {
  const cid = clinicId ?? getClinicId();
  const period = getCurrentPeriod();
  const now = nowStr();

  const existing = db
    .prepare("SELECT id FROM usage WHERE clinic_id = ? AND period = ?")
    .get(cid, period) as { id: number } | undefined;

  if (existing) {
    db.prepare(
      "UPDATE usage SET whatsapp_conversations = whatsapp_conversations + ?, updated_at = ? WHERE id = ?"
    ).run(amount, now, existing.id);
  } else {
    db.prepare(
      "INSERT INTO usage (clinic_id, period, whatsapp_conversations, ai_interactions, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)"
    ).run(cid, period, amount, now, now);
  }
}

// ── AI Usage ───────────────────────────────────────────────────────────

export function getAiUsage(clinicId?: number): UsageCheck {
  const cid = clinicId ?? getClinicId();
  const plan = getClinicPlan(cid);
  const period = getCurrentPeriod();
  const limit = plan.limits.maxAiInteractions;

  const row = db
    .prepare("SELECT ai_interactions FROM usage WHERE clinic_id = ? AND period = ?")
    .get(cid, period) as { ai_interactions: number } | undefined;
  const current = row?.ai_interactions ?? 0;

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

export function canUseAI(clinicId?: number): boolean {
  return getAiUsage(clinicId).allowed;
}

export function canUseAiInteraction(clinicId?: number): boolean {
  return canUseAI(clinicId);
}

export function incrementAiUsage(clinicId?: number, amount = 1): void {
  const cid = clinicId ?? getClinicId();
  const period = getCurrentPeriod();
  const now = nowStr();

  const existing = db
    .prepare("SELECT id FROM usage WHERE clinic_id = ? AND period = ?")
    .get(cid, period) as { id: number } | undefined;

  if (existing) {
    db.prepare(
      "UPDATE usage SET ai_interactions = ai_interactions + ?, updated_at = ? WHERE id = ?"
    ).run(amount, now, existing.id);
  } else {
    db.prepare(
      "INSERT INTO usage (clinic_id, period, whatsapp_conversations, ai_interactions, created_at, updated_at) VALUES (?, ?, 0, ?, ?, ?)"
    ).run(cid, period, amount, now, now);
  }
}

// ── Dashboard Usage ────────────────────────────────────────────────────

export function getUsageDashboard(clinicId?: number) {
  const cid = clinicId ?? getClinicId();
  const plan = getClinicPlan(cid);
  const whatsapp = getWhatsappUsage(cid);
  const ai = getAiUsage(cid);
  const professionals = canAddProfessional(cid);
  const adminUsers = canAddAdminUser(cid);
  const units = canAddUnit(cid);

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
  };
}

// ── Downgrade Check ────────────────────────────────────────────────────

export function canDowngradeTo(targetPlanId: PlanId, clinicId?: number): {
  allowed: boolean;
  issues: string[];
} {
  const cid = clinicId ?? getClinicId();
  const targetPlan = getPlan(targetPlanId);
  const issues: string[] = [];

  const professionalCheck = canAddProfessional(cid);
  if (professionalCheck.current > targetPlan.limits.maxProfessionals && isFinite(targetPlan.limits.maxProfessionals)) {
    issues.push(
      `Sua clínica possui ${professionalCheck.current} profissionais, mas o plano ${targetPlan.name} permite apenas ${targetPlan.limits.maxProfessionals}. Reduza a quantidade de profissionais ativos ou escolha outro plano.`
    );
  }

  const adminCheck = canAddAdminUser(cid);
  if (adminCheck.current > targetPlan.limits.maxAdminUsers && isFinite(targetPlan.limits.maxAdminUsers)) {
    issues.push(
      `Sua clínica possui ${adminCheck.current} usuários administrativos, mas o plano ${targetPlan.name} permite apenas ${targetPlan.limits.maxAdminUsers}.`
    );
  }

  const unitsCheck = canAddUnit(cid);
  if (unitsCheck.current > targetPlan.limits.maxUnits && isFinite(targetPlan.limits.maxUnits)) {
    issues.push(
      `Sua clínica possui ${unitsCheck.current} unidades, mas o plano ${targetPlan.name} permite apenas ${targetPlan.limits.maxUnits}.`
    );
  }

  return { allowed: issues.length === 0, issues };
}
