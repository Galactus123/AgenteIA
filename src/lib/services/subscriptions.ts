import { db } from "@/lib/db";
import { getClinic } from "@/lib/services/clinics";
import { nowStr } from "@/lib/datetime";
import { sendKomunikaMessage } from "@/lib/services/komunika";
import { renderOverageReceiptText, type OverageReceiptData } from "@/lib/email-templates/overage-receipt";
import type { BillingEvent, Clinic, ClinicAlert, SubscriptionInfo } from "@/lib/types";

export const OVERAGE_PACK_TOKENS = 50_000;
export const OVERAGE_PACK_PRICE_MZN = 300;
export const OVERAGE_PACK_CURRENCY = "MZN";
export const NEAR_LIMIT_THRESHOLD = 0.8;

const overagePackPrice = () => {
  const configured = Number(process.env.OVERAGE_PACK_PRICE);
  return Number.isFinite(configured) && configured > 0 ? configured : OVERAGE_PACK_PRICE_MZN;
};

export function getSubscription(): SubscriptionInfo | null {
  const clinic = getClinic();
  if (!clinic) return null;
  const usagePercent =
    clinic.token_limit > 0
      ? Math.min(100, Math.round((clinic.current_token_usage / clinic.token_limit) * 100))
      : 0;
  return {
    ...clinic,
    usagePercent,
    quotaExhausted: clinic.current_token_usage >= clinic.token_limit,
    nearLimit: clinic.current_token_usage >= clinic.token_limit * NEAR_LIMIT_THRESHOLD,
  };
}

// Guard pré-chamada de IA: só libera a chamada se houver cota disponível.
export function hasAiQuota(): boolean {
  const clinic = getClinic();
  if (!clinic) return false;
  return clinic.current_token_usage < clinic.token_limit;
}

// Contabilidade pós-chamada: acumula tokens consumidos e dispara alerta de 80%.
export function consumeTokens(amount: number): { clinic: Clinic | null; nearLimitAlert: boolean } {
  const clinic = getClinic();
  if (!clinic) return { clinic: null, nearLimitAlert: false };

  const usage = clinic.current_token_usage + Math.max(0, Math.round(amount));
  db.prepare("UPDATE clinics SET current_token_usage = ? WHERE id = ?").run(usage, clinic.id);

  let nearLimitAlert = false;
  if (usage >= clinic.token_limit) {
    db.prepare("UPDATE clinics SET subscription_status = 'quota_exhausted' WHERE id = ?").run(clinic.id);
  } else if (!clinic.near_limit_notified && usage >= clinic.token_limit * NEAR_LIMIT_THRESHOLD) {
    db.prepare("UPDATE clinics SET near_limit_notified = 1 WHERE id = ?").run(clinic.id);
    createAlert(
      "near_limit",
      "A clínica atingiu 80% da cota mensal de tokens da IA. Considere adquirir um pacote excedente."
    );
    nearLimitAlert = true;
  }

  return { clinic: getClinic(), nearLimitAlert };
}

// Bloqueia a clínica por cota esgotada e notifica a recepção (uma única vez por ciclo).
export function blockForQuota(patientPhone?: string): void {
  const clinic = getClinic();
  if (!clinic) return;
  const alreadyBlocked = clinic.subscription_status === "quota_exhausted";
  db.prepare("UPDATE clinics SET subscription_status = 'quota_exhausted' WHERE id = ?").run(clinic.id);
  if (alreadyBlocked) return;

  createAlert(
    "quota_exhausted",
    "A cota de tokens da IA foi esgotada. As novas conversas serão transferidas para atendimento humano até a compra de um pacote excedente."
  );
  if (patientPhone) {
    void notifyReception(
      `Atenção recepção: a cota de tokens da IA da clínica foi esgotada. O paciente ${patientPhone} foi transferido para atendimento manual.`
    );
  }
}

export function createAlert(type: string, message: string): ClinicAlert {
  const clinic = getClinic();
  const clinicId = clinic?.id ?? 1;
  const result = db
    .prepare("INSERT INTO clinic_alerts (clinic_id, type, message, created_at) VALUES (?, ?, ?, ?)")
    .run(clinicId, type, message, nowStr());
  return db
    .prepare("SELECT * FROM clinic_alerts WHERE id = ?")
    .get(Number(result.lastInsertRowid)) as unknown as ClinicAlert;
}

export function listAlerts(limit = 30): ClinicAlert[] {
  return db
    .prepare("SELECT * FROM clinic_alerts ORDER BY created_at DESC, id DESC LIMIT ?")
    .all(limit) as unknown as ClinicAlert[];
}

export async function notifyReception(message: string): Promise<void> {
  const clinic = getClinic();
  if (!clinic?.whatsapp) return;
  try {
    await sendKomunikaMessage(clinic.whatsapp, message, { type: "text" });
  } catch (err) {
    console.error("[subscriptions] Falha ao notificar a recepção:", err);
  }
}

// Compra de pacote excedente de 50.000 tokens (gestor/admin autenticado).
export function buyOveragePack(): { clinic: Clinic | null; billingEvent: BillingEvent } {
  const clinic = getClinic();
  if (!clinic) throw new Error("Clínica não encontrada.");

  const newTokenLimit = clinic.token_limit + OVERAGE_PACK_TOKENS;
  db.prepare(
    "UPDATE clinics SET token_limit = token_limit + ?, overage_blocks_purchased = overage_blocks_purchased + 1, subscription_status = 'active' WHERE id = ?"
  ).run(OVERAGE_PACK_TOKENS, clinic.id);

  const eventResult = db
    .prepare(
      "INSERT INTO billing_events (clinic_id, type, amount, currency, tokens, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .run(
      clinic.id,
      "overage_pack",
      overagePackPrice(),
      OVERAGE_PACK_CURRENCY,
      OVERAGE_PACK_TOKENS,
      `Pacote excedente de ${OVERAGE_PACK_TOKENS.toLocaleString("pt-BR")} tokens`,
      nowStr()
    );
  const billingEvent = db
    .prepare("SELECT * FROM billing_events WHERE id = ?")
    .get(Number(eventResult.lastInsertRowid)) as unknown as BillingEvent;

  createAlert("overage_pack", "Pacote excedente de 50.000 tokens adquirido. Atendimento automático por IA reativado.");
  console.log(
    `[subscriptions] Pacote excedente adquirido: token_limit=${newTokenLimit.toLocaleString("pt-BR")}, blocos=${clinic.overage_blocks_purchased + 1}`
  );

  sendReceiptByWhatsApp(clinic, billingEvent, newTokenLimit);

  return { clinic: getClinic(), billingEvent };
}

function sendReceiptByWhatsApp(clinic: Clinic, billingEvent: BillingEvent, newTokenLimit: number): void {
  if (!clinic.whatsapp) return;
  const receiptData: OverageReceiptData = {
    clinicName: clinic.name,
    paymentMethod: "M-Pesa / eMola",
    transactionId: `SS-${clinic.id}-${billingEvent.id}`,
    amount: overagePackPrice(),
    currency: OVERAGE_PACK_CURRENCY,
    tokens: OVERAGE_PACK_TOKENS,
    newTokenLimit,
  };
  void sendKomunikaMessage(clinic.whatsapp, renderOverageReceiptText(receiptData), { type: "text" });
}

// Reset mensal de ciclo de faturamento (cron job no scheduler do processo).
export function runSubscriptionCycleCheck(): void {
  const clinic = getClinic();
  if (!clinic) return;

  const now = new Date();
  const cycleDay = clinic.billing_cycle_day || 1;
  if (now.getDate() !== cycleDay) return;

  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  if (clinic.last_reset_at && clinic.last_reset_at.slice(0, 7) === monthKey) return;

  resetSubscriptionCycle();
}

export function resetSubscriptionCycle(): void {
  const clinic = getClinic();
  if (!clinic) return;

  db.prepare(
    "UPDATE clinics SET current_token_usage = 0, near_limit_notified = 0, overage_blocks_purchased = 0, token_limit = base_token_limit, subscription_status = 'active', last_reset_at = ? WHERE id = ?"
  ).run(nowStr(), clinic.id);

  createAlert("cycle_reset", "Novo ciclo de faturamento iniciado. A cota de tokens da IA foi restaurada.");
  console.log(`[subscriptions] Ciclo de faturamento resetado para a clínica ${clinic.id}`);
}