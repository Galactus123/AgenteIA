// ── Utilitarios LGPD — Privacidade e Protecao de Dados ────────────────
// Funcoes para anonimizacao, retencao e gestao de dados pessoais
// conforme a Lei Geral de Protecao de Dados (Lei 13.709/2018).

import { supabaseAdmin } from "@/lib/supabase";
import { createHash } from "node:crypto";

// ── Anonimizacao ──────────────────────────────────────────────────────

/**
 * Mascara um email para exibicao: jo***@ex***.com
 */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";
  const maskedLocal = local.length > 2 ? local[0] + "***" : "***";
  const parts = domain.split(".");
  const maskedDomain = parts.length > 1 ? parts[0][0] + "***" : "***";
  return `${maskedLocal}@${maskedDomain}.${parts[parts.length - 1]}`;
}

/**
 * Mascara um telefone: +258 84 *** **67
 */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 6) return "***";
  const visibleStart = digits.slice(0, 4);
  const visibleEnd = digits.slice(-2);
  const maskedMiddle = "*".repeat(Math.min(digits.length - 6, 4));
  return `+${visibleStart}${maskedMiddle}${visibleEnd}`;
}

/**
 * Mascara um nome: J. S. ou J*** S***
 */
export function maskName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "***";
  if (parts.length === 1) return parts[0][0] + "***";
  return `${parts[0][0]}. ${parts[parts.length - 1][0]}.`;
}

/**
 * Gera um hash pseudonimo para um identificador (preserva unicidade sem expor o dado).
 */
export function pseudonymize(identifier: string): string {
  return createHash("sha256")
    .update(identifier + (process.env.SESSION_SECRET ?? "lgpd-salt"))
    .digest("hex")
    .slice(0, 16);
}

// ── Retencao de Dados ─────────────────────────────────────────────────

export interface RetentionResult {
  table: string;
  deleted: number;
  anonymized: number;
}

/**
 * Remove mensagens de conversas antigas (acima de N dias).
 * Padrao: 90 dias para mensagens de WhatsApp.
 */
export async function retainMessages(maxAgeDays: number = 90): Promise<RetentionResult> {
  const cutoff = new Date(Date.now() - maxAgeDays * 86400000).toISOString();

  const { count } = await supabaseAdmin
    .from("messages")
    .select("id", { count: "exact", head: true })
    .lt("created_at", cutoff);

  const { error } = await supabaseAdmin.from("messages").delete().lt("created_at", cutoff);
  if (error) console.error("[lgpd] Falha ao remover mensagens:", error.message);

  return {
    table: "messages",
    deleted: error ? 0 : (count ?? 0),
    anonymized: 0,
  };
}

/**
 * Anonimiza dados de pacientes inativos (sem consultas nos ultimos N dias).
 * Remove nome, telefone e email, mantendo apenas dados agregados para estatisticas.
 */
export async function anonymizeInactivePatients(
  inactiveDays: number = 365
): Promise<RetentionResult> {
  const cutoff = new Date(Date.now() - inactiveDays * 86400000).toISOString();

  // Encontrar conversas sem atividade recente
  const { data: inactiveConversations, error } = await supabaseAdmin
    .from("conversations")
    .select("id, phone, patient_name")
    .lt("updated_at", cutoff)
    .neq("status", "open");

  if (error) {
    console.error("[lgpd] Falha ao consultar conversas inativas:", error.message);
    return { table: "conversations", deleted: 0, anonymized: 0 };
  }

  let anonymized = 0;
  for (const conv of inactiveConversations ?? []) {
    const pseudonym = pseudonymize(conv.phone);

    // Anonimizar conversa
    const { error: convError } = await supabaseAdmin
      .from("conversations")
      .update({ patient_name: `Paciente-${pseudonym}`, phone: `anon-${pseudonym}` })
      .eq("id", conv.id);
    if (convError) {
      console.error("[lgpd] Falha ao anonimizar conversa:", convError.message);
      continue;
    }

    // Anonimizar mensagens
    const { error: msgError } = await supabaseAdmin
      .from("messages")
      .update({ content: "[DADO ANONIMIZADO]" })
      .eq("conversation_id", conv.id)
      .eq("sender", "patient");
    if (msgError) {
      console.error("[lgpd] Falha ao anonimizar mensagens:", msgError.message);
      continue;
    }

    anonymized++;
  }

  return {
    table: "conversations",
    deleted: 0,
    anonymized,
  };
}

/**
 * Remove contas de usuarios deletados/inescapaveis apos periodo de retencao.
 */
export async function purgeDeletedUsers(retentionDays: number = 30): Promise<RetentionResult> {
  const cutoff = new Date(Date.now() - retentionDays * 86400000).toISOString();

  const { count } = await supabaseAdmin
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("status", "inactive")
    .lt("created_at", cutoff);

  const { error } = await supabaseAdmin
    .from("users")
    .delete()
    .eq("status", "inactive")
    .lt("created_at", cutoff);
  if (error) console.error("[lgpd] Falha ao remover utilizadores:", error.message);

  return {
    table: "users",
    deleted: error ? 0 : (count ?? 0),
    anonymized: 0,
  };
}

/**
 * Executa todas as politicas de retencao de dados.
 * Chamado periodicamente pelo scheduler.
 */
export async function runRetentionPolicies(): Promise<RetentionResult[]> {
  const results: RetentionResult[] = [];

  try {
    results.push(await retainMessages(90));
  } catch (err) {
    console.error("[lgpd] Erro na retencao de mensagens:", err);
  }

  try {
    results.push(await anonymizeInactivePatients(365));
  } catch (err) {
    console.error("[lgpd] Erro na anonimizacao de pacientes:", err);
  }

  try {
    results.push(await purgeDeletedUsers(30));
  } catch (err) {
    console.error("[lgpd] Erro na limpeza de usuarios:", err);
  }

  return results;
}

// ── Consentimento (registro basico) ───────────────────────────────────

/**
 * Registra o consentimento do usuario para processamento de dados.
 * Nota: Em producao, isso deve ser uma tabela dedicada no banco.
 */
export function recordConsent(
  userId: number,
  consentType: "terms" | "privacy" | "marketing",
  granted: boolean
): void {
  console.log(
    `[lgpd] Consentimento registrado: userId=${userId} type=${consentType} granted=${granted} at=${new Date().toISOString()}`
  );
}

/**
 * Verifica se o usuario deu consentimento para um tipo especifico.
 */
export function hasConsent(userId: number, consentType: string): boolean {
  // Em producao, consultar tabela de consentimentos
  // Por padrao, assumir consentimento para termos e privacidade
  if (consentType === "terms" || consentType === "privacy") return true;
  return false;
}
