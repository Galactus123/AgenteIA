// ── Audit log — registro de atividades (PRD → Segurança) ────────────────────
// Toda escrita é best-effort: falhar a auditoria nunca derruba a operação
// de negócio (a ausência de trilha é registrada em console.error).

import type { NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase";
import { getUser } from "@/lib/api-auth";
import { clientIp } from "@/lib/rate-limit";
import { maskEmail } from "@/lib/lgpd";

export interface AuditEntry {
  clinicId?: number;
  actorId?: string | null;
  actorLabel?: string | null;
  action: string;
  entity?: string | null;
  entityId?: string | number | null;
  meta?: Record<string, unknown> | null;
  ip?: string | null;
}

export interface AuditRow {
  id: number;
  clinic_id: number | null;
  actor_id: string | null;
  actor_label: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  meta: Record<string, unknown> | null;
  ip: string | null;
  created_at: string;
}

/** Grava um evento. Nunca lança erro. */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    // Sem clínica resolvida o evento fica com clinic_id nulo em vez de cair
    // na "primeira clínica" da base (o que misturaria trilhas de tenants).
    const { error } = await supabaseAdmin.from("audit_logs").insert({
      clinic_id: entry.clinicId ?? null,
      actor_id: entry.actorId ?? null,
      actor_label: entry.actorLabel ?? null,
      action: entry.action,
      entity: entry.entity ?? null,
      entity_id: entry.entityId != null ? String(entry.entityId) : null,
      meta: entry.meta ?? null,
      ip: entry.ip ?? null,
    });
    if (error) console.error("[audit] Falha ao gravar evento:", error.message);
  } catch (err) {
    console.error("[audit] Falha inesperada ao gravar evento:", err instanceof Error ? err.message : err);
  }
}

/**
 * Auditoria a partir de uma requisição do painel: resolve o usuário da
 * sessão, mascara o e-mail (actor_label nunca guarda PII crua) e inclui o IP.
 */
export async function auditRequest(
  request: NextRequest,
  entry: Omit<AuditEntry, "actorId" | "actorLabel" | "ip"> & { user?: User | null }
): Promise<void> {
  try {
    const user = entry.user !== undefined ? entry.user : await getUser(request);
    await recordAudit({
      clinicId: entry.clinicId,
      actorId: user?.id ?? null,
      actorLabel: user?.email ? maskEmail(user.email) : (user ? user.id : null),
      action: entry.action,
      entity: entry.entity ?? null,
      entityId: entry.entityId ?? null,
      meta: entry.meta ?? null,
      ip: clientIp(request),
    });
  } catch (err) {
    console.error("[audit] Falha ao auditar a partir da requisicao:", err instanceof Error ? err.message : err);
  }
}

/** Últimos eventos da clínica (limitado; painel de auditoria). */
export async function listAuditLogs(options: {
  clinicId: number;
  limit?: number;
}): Promise<AuditRow[]> {
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 500);
  const clinicId = options.clinicId;

  const { data, error } = await supabaseAdmin
    .from("audit_logs")
    .select("*")
    .eq("clinic_id", clinicId)
    .order("id", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[audit] Falha ao listar eventos:", error.message);
    return [];
  }
  return (data ?? []) as AuditRow[];
}
