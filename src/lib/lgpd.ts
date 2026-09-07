// ── Utilitarios LGPD — Privacidade e Protecao de Dados ────────────────
// Funcoes para anonimizacao, retencao e gestao de dados pessoais
// conforme a Lei Geral de Protecao de Dados (Lei 13.709/2018).

import { db } from "@/lib/db";
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
export function retainMessages(maxAgeDays: number = 90): RetentionResult {
  const cutoff = new Date(Date.now() - maxAgeDays * 86400000).toISOString();

  const messagesToDelete = db
    .prepare("SELECT COUNT(*) as c FROM messages WHERE created_at < ?")
    .get(cutoff) as { c: number };

  db.prepare("DELETE FROM messages WHERE created_at < ?").run(cutoff);

  return {
    table: "messages",
    deleted: messagesToDelete.c,
    anonymized: 0,
  };
}

/**
 * Anonimiza dados de pacientes inativos (sem consultas nos ultimos N dias).
 * Remove nome, telefone e email, mantendo apenas dados agregados para estatisticas.
 */
export function anonymizeInactivePatients(inactiveDays: number = 365): RetentionResult {
  const cutoff = new Date(Date.now() - inactiveDays * 86400000).toISOString();

  // Encontrar conversas sem atividade recente
  const inactiveConversations = db
    .prepare(
      `SELECT id, phone, patient_name FROM conversations
       WHERE updated_at < ? AND status != 'open'`
    )
    .all(cutoff) as { id: number; phone: string; patient_name: string }[];

  let anonymized = 0;
  for (const conv of inactiveConversations) {
    const pseudonym = pseudonymize(conv.phone);

    // Anonimizar conversa
    db.prepare(
      "UPDATE conversations SET patient_name = ?, phone = ? WHERE id = ?"
    ).run(`Paciente-${pseudonym}`, `anon-${pseudonym}`, conv.id);

    // Anonimizar mensagens
    db.prepare(
      "UPDATE messages SET content = '[DADO ANONIMIZADO]' WHERE conversation_id = ? AND sender = 'patient'"
    ).run(conv.id);

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
export function purgeDeletedUsers(retentionDays: number = 30): RetentionResult {
  const cutoff = new Date(Date.now() - retentionDays * 86400000).toISOString();

  const usersToDelete = db
    .prepare("SELECT COUNT(*) as c FROM users WHERE status = 'inactive' AND created_at < ?")
    .get(cutoff) as { c: number };

  db.prepare("DELETE FROM users WHERE status = 'inactive' AND created_at < ?").run(cutoff);

  return {
    table: "users",
    deleted: usersToDelete.c,
    anonymized: 0,
  };
}

/**
 * Executa todas as politicas de retencao de dados.
 * Chamado periodicamente pelo scheduler.
 */
export function runRetentionPolicies(): RetentionResult[] {
  const results: RetentionResult[] = [];

  try {
    results.push(retainMessages(90));
  } catch (err) {
    console.error("[lgpd] Erro na retencao de mensagens:", err);
  }

  try {
    results.push(anonymizeInactivePatients(365));
  } catch (err) {
    console.error("[lgpd] Erro na anonimizacao de pacientes:", err);
  }

  try {
    results.push(purgeDeletedUsers(30));
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
