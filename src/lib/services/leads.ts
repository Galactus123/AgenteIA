import { supabaseAdmin } from "@/lib/supabase";
import { type PlanId } from "@/lib/plans";

// ── Leads do funil público (/teste-gratis) ──────────────────────────────────
//
// O formulário é público (sem sessão): quem preenche ainda não tem conta.
// A validação acontece sempre no servidor — o browser não é fonte de
// verdade — e a gravação usa o service_role, única credencial com acesso
// a `trial_leads` (RLS deny-all, ver migration 20261007000001).
//
// Regra de ouro: campos obrigatórios (clínica, nome, WhatsApp) são
// validados a sério; campos de atribuição opcionais (país, plano, fonte,
// utm) são saneados e ignorados se inválidos — nunca se perde um lead
// válido por causa de um parâmetro de campanha manipulado.

export interface TrialLeadInput {
  clinicName?: unknown;
  contactName?: unknown;
  whatsapp?: unknown;
  country?: unknown;
  specialty?: unknown;
  email?: unknown;
  plan?: unknown;
  source?: unknown;
  utmSource?: unknown;
}

export interface TrialLead {
  clinic_name: string;
  contact_name: string;
  whatsapp: string;
  country: "br" | "mz";
  specialty: string | null;
  email: string | null;
  plan: PlanId | null;
  source: string;
  utm_source: string | null;
}

export type ParseTrialLeadResult =
  | { ok: true; value: TrialLead }
  | { ok: false; error: string };

export interface SaveTrialLeadResult {
  ok: boolean;
  duplicate?: boolean;
}

const PLAN_IDS: readonly string[] = ["start", "pro", "business", "enterprise"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Atribuição vem de query strings: só símbolos de campanha comuns.
const CAMPAIGN_RE = /^[a-zA-Z0-9._-]{1,60}$/;
const MAX_NAME = 120;
const MAX_WHATSAPP_DIGITS = 15;
const MIN_WHATSAPP_DIGITS = 7;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Apenas dígitos, com tamanho de número de telefone plausível. */
function normalizeWhatsApp(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < MIN_WHATSAPP_DIGITS || digits.length > MAX_WHATSAPP_DIGITS) {
    return null;
  }
  return digits;
}

export function parseTrialLead(input: unknown): ParseTrialLeadResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "Dados do formulário inválidos." };
  }
  const raw = input as TrialLeadInput;

  const clinicName = text(raw.clinicName);
  if (clinicName.length < 2) {
    return { ok: false, error: "Informe o nome da clínica." };
  }

  const contactName = text(raw.contactName);
  if (contactName.length < 2) {
    return { ok: false, error: "Informe o seu nome." };
  }

  const whatsapp = normalizeWhatsApp(text(raw.whatsapp));
  if (!whatsapp) {
    return { ok: false, error: "Informe um WhatsApp válido com 7 a 15 dígitos." };
  }

  const email = text(raw.email).toLowerCase();
  if (email && (email.length > 200 || !EMAIL_RE.test(email))) {
    return { ok: false, error: "E-mail inválido." };
  }

  // Atribuição: nunca rejeita o lead por causa destes campos.
  const country = text(raw.country);
  const plan = text(raw.plan);
  const source = text(raw.source);
  const utmSource = text(raw.utmSource);

  return {
    ok: true,
    value: {
      clinic_name: clinicName.slice(0, MAX_NAME),
      contact_name: contactName.slice(0, MAX_NAME),
      whatsapp,
      country: country === "mz" ? "mz" : "br",
      specialty: text(raw.specialty).slice(0, 80) || null,
      email: email || null,
      plan: (PLAN_IDS.includes(plan) ? plan : null) as PlanId | null,
      source: CAMPAIGN_RE.test(source) ? source : "teste-gratis",
      utm_source: CAMPAIGN_RE.test(utmSource) ? utmSource : null,
    },
  };
}

/**
 * Grava o lead. `23505` (e-mail já registado) conta como sucesso: é o
 * retry de rede ou o duplo clique do próprio utilizador, e o lead já
 * está na base — responder erro só faria o formulário falhar à frente.
 */
export async function saveTrialLead(lead: TrialLead): Promise<SaveTrialLeadResult> {
  const { error } = await supabaseAdmin.from("trial_leads").insert(lead);

  if (!error) return { ok: true };
  if (error.code === "23505") return { ok: true, duplicate: true };

  console.error("[leads] Falha ao gravar lead de teste grátis:", error.message);
  return { ok: false };
}
