import { supabaseAdmin } from "@/lib/supabase";
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

export async function getSubscription(): Promise<SubscriptionInfo | null> {
  const clinic = await getClinic();
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
export async function hasAiQuota(): Promise<boolean> {
  const clinic = await getClinic();
  if (!clinic) return false;
  return clinic.current_token_usage < clinic.token_limit;
}

// Contabilidade pós-chamada: acumula tokens consumidos e dispara alerta de 80%.
export async function consumeTokens(
  amount: number
): Promise<{ clinic: Clinic | null; nearLimitAlert: boolean }> {
  const clinic = await getClinic();
  if (!clinic) return { clinic: null, nearLimitAlert: false };

  const usage = clinic.current_token_usage + Math.max(0, Math.round(amount));
  const patch: Record<string, unknown> = { current_token_usage: usage };
  let nearLimitAlert = false;

  if (usage >= clinic.token_limit) {
    patch.subscription_status = "quota_exhausted";
  } else if (!clinic.near_limit_notified && usage >= clinic.token_limit * NEAR_LIMIT_THRESHOLD) {
    patch.near_limit_notified = 1;
    nearLimitAlert = true;
  }

  await updateClinicRow(clinic.id, patch);

  if (nearLimitAlert) {
    await createAlert(
      "near_limit",
      "A clínica atingiu 80% da cota mensal de tokens da IA. Considere adquirir um pacote excedente."
    );
  }

  return { clinic: await getClinic(), nearLimitAlert };
}

// Bloqueia a clínica por cota esgotada e notifica a recepção (uma única vez por ciclo).
export async function blockForQuota(patientPhone?: string): Promise<void> {
  const clinic = await getClinic();
  if (!clinic) return;
  const alreadyBlocked = clinic.subscription_status === "quota_exhausted";
  await updateClinicRow(clinic.id, { subscription_status: "quota_exhausted" });
  if (alreadyBlocked) return;

  await createAlert(
    "quota_exhausted",
    "A cota de tokens da IA foi esgotada. As novas conversas serão transferidas para atendimento humano até a compra de um pacote excedente."
  );
  if (patientPhone) {
    await notifyReception(
      `Atenção recepção: a cota de tokens da IA da clínica foi esgotada. O paciente ${patientPhone} foi transferido para atendimento manual.`
    );
  }
}

export async function createAlert(type: string, message: string): Promise<ClinicAlert> {
  const clinic = await getClinic();
  const clinicId = clinic?.id ?? 1;

  const { data, error } = await supabaseAdmin
    .from("clinic_alerts")
    .insert({ clinic_id: clinicId, type, message, created_at: nowStr() })
    .select("*")
    .single();

  if (error) {
    console.error("[subscriptions] Falha ao criar alerta:", error.message);
    throw new Error(`Falha ao criar alerta: ${error.message}`);
  }
  return data;
}

export async function listAlerts(limit = 30): Promise<ClinicAlert[]> {
  const { data, error } = await supabaseAdmin
    .from("clinic_alerts")
    .select("*")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[subscriptions] Falha ao listar alertas:", error.message);
    return [];
  }
  return data ?? [];
}

export async function notifyReception(message: string): Promise<void> {
  const clinic = await getClinic();
  if (!clinic?.whatsapp) return;
  try {
    await sendKomunikaMessage(clinic.whatsapp, message, { type: "text" });
  } catch (err) {
    console.error("[subscriptions] Falha ao notificar a recepção:", err);
  }
}

// Compra de pacote excedente de 50.000 tokens (gestor/admin autenticado).
export async function buyOveragePack(): Promise<{ clinic: Clinic | null; billingEvent: BillingEvent }> {
  const clinic = await getClinic();
  if (!clinic) throw new Error("Clínica não encontrada.");

  const newTokenLimit = clinic.token_limit + OVERAGE_PACK_TOKENS;
  const { error: limitError } = await supabaseAdmin
    .from("clinics")
    .update({
      token_limit: clinic.token_limit + OVERAGE_PACK_TOKENS,
      overage_blocks_purchased: clinic.overage_blocks_purchased + 1,
      subscription_status: "active",
    })
    .eq("id", clinic.id);

  if (limitError) throw new Error(`Falha ao atualizar a cota: ${limitError.message}`);

  const { data: billingData, error: billingError } = await supabaseAdmin
    .from("billing_events")
    .insert({
      clinic_id: clinic.id,
      type: "overage_pack",
      amount: overagePackPrice(),
      currency: OVERAGE_PACK_CURRENCY,
      tokens: OVERAGE_PACK_TOKENS,
      description: `Pacote excedente de ${OVERAGE_PACK_TOKENS.toLocaleString("pt-BR")} tokens`,
      created_at: nowStr(),
    })
    .select("*")
    .single();

  if (billingError) throw new Error(`Falha ao registar a cobrança: ${billingError.message}`);
  const billingEvent = billingData as unknown as BillingEvent;

  await createAlert(
    "overage_pack",
    "Pacote excedente de 50.000 tokens adquirido. Atendimento automático por IA reativado."
  );
  console.log(
    `[subscriptions] Pacote excedente adquirido: token_limit=${newTokenLimit.toLocaleString("pt-BR")}, blocos=${clinic.overage_blocks_purchased + 1}`
  );

  await sendReceiptByWhatsApp(clinic, billingEvent, newTokenLimit);

  return { clinic: await getClinic(), billingEvent };
}

async function sendReceiptByWhatsApp(
  clinic: Clinic,
  billingEvent: BillingEvent,
  newTokenLimit: number
): Promise<void> {
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
  try {
    await sendKomunikaMessage(
      clinic.whatsapp,
      renderOverageReceiptText(receiptData),
      { type: "text" }
    );
  } catch (err) {
    console.error("[subscriptions] Falha ao enviar o recibo:", err);
  }
}

// Reset mensal de ciclo de faturamento (cron job no scheduler do processo).
export async function runSubscriptionCycleCheck(): Promise<void> {
  const clinic = await getClinic();
  if (!clinic) return;

  const now = new Date();
  const cycleDay = clinic.billing_cycle_day || 1;
  if (now.getDate() !== cycleDay) return;

  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  if (clinic.last_reset_at && clinic.last_reset_at.slice(0, 7) === monthKey) return;

  await resetSubscriptionCycle();
}

export async function resetSubscriptionCycle(): Promise<void> {
  const clinic = await getClinic();
  if (!clinic) return;

  const { error } = await supabaseAdmin
    .from("clinics")
    .update({
      current_token_usage: 0,
      near_limit_notified: 0,
      overage_blocks_purchased: 0,
      token_limit: clinic.base_token_limit,
      subscription_status: "active",
      last_reset_at: nowStr(),
    })
    .eq("id", clinic.id);

  if (error) {
    console.error("[subscriptions] Falha ao reiniciar o ciclo:", error.message);
    return;
  }

  await createAlert(
    "cycle_reset",
    "Novo ciclo de faturamento iniciado. A cota de tokens da IA foi restaurada."
  );
  console.log(`[subscriptions] Ciclo de faturamento resetado para a clínica ${clinic.id}`);
}

async function updateClinicRow(clinicId: number, patch: Record<string, unknown>): Promise<void> {
  const { error } = await supabaseAdmin.from("clinics").update(patch).eq("id", clinicId);
  if (error) console.error("[subscriptions] Falha ao atualizar a clínica:", error.message);
}
