import { supabaseAdmin } from "@/lib/supabase";
import { addMinutes, formatDateTime, nowStr, parseDatetime } from "@/lib/datetime";
import { guardActiveSubscription } from "@/lib/services/plan-limits";
import {
  checkKomunikaNumber,
  cleanResponseText,
  getKomunikaInstanceIdForClinic,
  isKomunikaConfigured,
  resolveKomunikaInstanceId,
  sendKomunikaMessage,
} from "@/lib/services/komunika";

export type OutboxKind = "chat_reply" | "reminder" | "transfer_notice";

export const OUTBOX_MAX_ATTEMPTS = 5;

// Backoff em minutos por tentativa ja concluida: 1, 5, 15, 60, 240.
const BACKOFF_MINUTES = [1, 5, 15, 60, 240];

export function backoffMinutes(attempts: number): number {
  if (attempts < 1) return BACKOFF_MINUTES[0];
  return BACKOFF_MINUTES[Math.min(attempts, BACKOFF_MINUTES.length) - 1];
}

export interface EnqueueMessageInput {
  phone: string;
  text: string;
  kind: OutboxKind;
  conversationId?: number | null;
  // Clinica dona da mensagem: a entrega usa a instancia WhatsApp propria
  // desta linha (clinics.komunika_instance_id) e so acontece com assinatura
  // ativa dessa clinica. Sem clinic_id (null) nao ha tenant — o gate de
  // assinatura bloqueia a entrega (fail-closed).
  clinicId?: number | null;
}

// Grava a mensagem na fila (status pending). Retorna null quando a
// mensagem e invalida (numero/texto vazio) ou quando o insert falha —
// nesse caso quem chamou pode desfazer o registro de origem e deixar
// a proxima execucao tentar de novo.
export async function enqueueOutboxMessage(input: EnqueueMessageInput): Promise<number | null> {
  const phone = input.phone.replace(/\D/g, "");
  const text = cleanResponseText(input.text);
  if (!phone || !text) {
    console.warn(`[outbox] Mensagem ignorada (kind=${input.kind}): numero ou texto vazio.`);
    return null;
  }

  const now = nowStr();
  const { data, error } = await supabaseAdmin
    .from("outbox")
    .insert({
      phone,
      text,
      kind: input.kind,
      conversation_id: input.conversationId ?? null,
      clinic_id: input.clinicId ?? null,
      status: "pending",
      attempts: 0,
      next_attempt_at: now,
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single();

  if (error) {
    console.error(`[outbox] Falha ao enfileirar (kind=${input.kind}):`, error.message);
    return null;
  }
  return data.id;
}

export interface OutboxRunResult {
  claimed: number;
  sent: number;
  retried: number;
  failed: number;
}

type DeliverOutcome =
  | { outcome: "sent" }
  | { outcome: "retry"; error: string }
  | { outcome: "failed"; error: string };

// Status 4xx da API da Komunica = erro definitivo (credencial, payload,
// numero invalido): nao adianta reenviar. 5xx/timeout/rede = transitorio.
const PERMANENT_HTTP_STATUS = new Set([400, 401, 403, 404, 422]);

async function deliver(
  phone: string,
  text: string,
  clinicId?: number | null
): Promise<DeliverOutcome> {
  // Acesso estrito pos-pagamento: sem assinatura PAGA ativa para a clínica
  // dona da mensagem (webhook da LOJOU) nada é enviado. Falha definitiva —
  // sem retry, porque o estado só muda com um novo evento de pagamento e a
  // mensagem antiga já perdeu a utilidade (lembrete/aviso datado).
  // clinicId null (linha sem tenant) também bloqueia: fail-closed.
  const gate = await guardActiveSubscription(clinicId);
  if (gate) {
    return {
      outcome: "failed",
      error: `Assinatura inativa (${gate.body.subscriptionStatus}).`,
    };
  }

  // Komunika sem configurar é um problema transitório do ambiente (env em
  // falta, deploy antes das chaves): reagenda com backoff em vez de matar a
  // mensagem à 1ª tentativa. Se persistir até OUTBOX_MAX_ATTEMPTS, acaba
  // mesmo em failed.
  if (!isKomunikaConfigured()) {
    return { outcome: "retry", error: "Komunika nao configurado." };
  }

  // Instancia WhatsApp da entrega: a propria da clinica (linha gravada na
  // outbox). clinic_id null so chega aqui com o kill switch
  // SUBSCRIPTION_GATE_DISABLED ligado — nesse caso cai na global do ambiente.
  const { instanceId } = clinicId
    ? await getKomunikaInstanceIdForClinic(clinicId)
    : { instanceId: resolveKomunikaInstanceId() };

  const check = await checkKomunikaNumber(phone, instanceId);
  if (check.ok && check.exists === false) {
    return { outcome: "failed", error: "Numero sem WhatsApp." };
  }

  const result = await sendKomunikaMessage(phone, text, { type: "text", instanceId });
  if (result.ok) return { outcome: "sent" };

  const error = `status=${result.status ?? "?"} ${result.error ?? "erro desconhecido"}`.trim();
  if (result.status !== undefined && PERMANENT_HTTP_STATUS.has(result.status)) {
    return { outcome: "failed", error };
  }
  return { outcome: "retry", error };
}

// Reclama um lote de pendentes (ou de 'sending' preso ha mais de
// 15 min, de execucoes mortas), envia e devolve contadores. O claim
// via UPDATE condicionado garante que duas execucoes concorrentes
// (pg_cron + disparo apos enqueue) nao enviem a mesma mensagem.
export async function processOutbox(limit = 20): Promise<OutboxRunResult> {
  const empty: OutboxRunResult = { claimed: 0, sent: 0, retried: 0, failed: 0 };
  const now = nowStr();
  const stale = formatDateTime(addMinutes(new Date(), -15));
  const claimable = `status.eq.pending,and(status.eq.sending,updated_at.lt."${stale}")`;

  const { data: candidates, error } = await supabaseAdmin
    .from("outbox")
    .select("id")
    .lte("next_attempt_at", now)
    .or(claimable)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("[outbox] Falha ao buscar pendentes:", error.message);
    return empty;
  }
  if (!candidates?.length) return empty;

  const { data: claimed, error: claimError } = await supabaseAdmin
    .from("outbox")
    .update({ status: "sending", updated_at: now })
    .in("id", candidates.map((row) => row.id))
    .or(claimable)
    .select("id, phone, text, attempts, clinic_id");

  if (claimError) {
    console.error("[outbox] Falha ao reclamar pendentes:", claimError.message);
    return empty;
  }
  if (!claimed?.length) return empty;

  const result: OutboxRunResult = { claimed: claimed.length, sent: 0, retried: 0, failed: 0 };

  for (const row of claimed as {
    id: number;
    phone: string;
    text: string;
    attempts: number;
    clinic_id: number | null;
  }[]) {
    const outcome = await deliver(row.phone, row.text, row.clinic_id);
    const attempts = row.attempts + 1;

    if (outcome.outcome === "sent") {
      const { error: doneError } = await supabaseAdmin
        .from("outbox")
        .update({ status: "sent", updated_at: nowStr(), last_error: null })
        .eq("id", row.id);
      if (doneError) console.error("[outbox] Falha ao marcar enviado:", doneError.message);
      result.sent++;
      continue;
    }

    const permanent = outcome.outcome === "failed" || attempts >= OUTBOX_MAX_ATTEMPTS;
    const patch: Record<string, unknown> = {
      status: permanent ? "failed" : "pending",
      attempts,
      last_error: outcome.error,
      updated_at: nowStr(),
      next_attempt_at: formatDateTime(addMinutes(parseDatetime(now), backoffMinutes(attempts))),
    };
    const { error: retryError } = await supabaseAdmin.from("outbox").update(patch).eq("id", row.id);
    if (retryError) console.error("[outbox] Falha ao reagendar:", retryError.message);
    if (permanent) result.failed++;
    else result.retried++;
  }

  return result;
}

// Disparo em background (fire-and-forget) apos cada enqueue.
export function processOutboxInBackground(): void {
  void processOutbox().catch((err) => {
    console.error("[outbox] Falha no processamento em background:", err);
  });
}
