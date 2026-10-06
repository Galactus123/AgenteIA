// ── Configuração Central de Planos da SaudeSync ─────────────────────────
// Todos os limites e features do sistema devem consultar este arquivo.

export type PlanId = "start" | "pro" | "business" | "enterprise";

export type FeatureId =
  | "agenda"
  | "patients"
  | "pep"
  | "professionals_management"
  | "units_management"
  | "team_management"
  | "whatsapp"
  | "auto_confirmation"
  | "reminders"
  | "auto_reschedule"
  | "auto_cancel"
  | "feedback"
  | "return_reminders"
  | "ai_assistant"
  | "ai_automation"
  | "smart_reports"
  | "advanced_ai"
  | "financial_control"
  | "financial_reports"
  | "indicators"
  | "advanced_dashboards"
  | "multi_unit"
  | "operational_management"
  | "priority_support"
  | "custom_config";

export interface PlanLimits {
  maxProfessionals: number;
  maxAdminUsers: number;
  maxUnits: number;
  maxWhatsappConversations: number;
  maxAiInteractions: number;
  // Conversas ativas simultaneas (linhas da tabela conversations).
  maxConversations: number;
  // Teto de tokens de IA por ciclo de faturamento (clinics.base_token_limit).
  // Sempre finito: a coluna e INTEGER no Postgres (Enterprise usa um teto
  // alto de cortesia; o excedente e comprado via pacotes overage).
  tokensPerCycle: number;
}

export interface Plan {
  id: PlanId;
  name: string;
  price: number;
  currency: string;
  billingInterval: "month";
  limits: PlanLimits;
  features: FeatureId[];
  highlighted?: boolean;
  buttonLabel: string;
  buttonVariant: "primary" | "secondary" | "outline";
  description: string;
}

// ── Lista de features por categoria (para tabela comparativa) ──────────

export const FEATURE_CATEGORIES = [
  {
    name: "Gestão",
    features: [
      { id: "agenda" as FeatureId, label: "Agenda inteligente" },
      { id: "patients" as FeatureId, label: "Cadastro de pacientes" },
      { id: "pep" as FeatureId, label: "PEP / Prontuário" },
      { id: "professionals_management" as FeatureId, label: "Gestão de profissionais" },
      { id: "units_management" as FeatureId, label: "Gestão de unidades" },
      { id: "team_management" as FeatureId, label: "Gestão de equipe" },
    ],
  },
  {
    name: "Automação",
    features: [
      { id: "whatsapp" as FeatureId, label: "WhatsApp" },
      { id: "auto_confirmation" as FeatureId, label: "Confirmação automática" },
      { id: "reminders" as FeatureId, label: "Lembretes" },
      { id: "auto_reschedule" as FeatureId, label: "Reagendamento automático" },
      { id: "auto_cancel" as FeatureId, label: "Cancelamento automático" },
      { id: "feedback" as FeatureId, label: "Feedback" },
      { id: "return_reminders" as FeatureId, label: "Lembretes de retorno" },
    ],
  },
  {
    name: "Inteligência",
    features: [
      { id: "ai_assistant" as FeatureId, label: "Assistente IA" },
      { id: "ai_automation" as FeatureId, label: "Automação com IA" },
      { id: "smart_reports" as FeatureId, label: "Relatórios inteligentes" },
      { id: "advanced_ai" as FeatureId, label: "Recursos avançados de IA" },
    ],
  },
  {
    name: "Gestão Financeira",
    features: [
      { id: "financial_control" as FeatureId, label: "Controle financeiro" },
      { id: "financial_reports" as FeatureId, label: "Relatórios financeiros" },
      { id: "indicators" as FeatureId, label: "Indicadores" },
      { id: "advanced_dashboards" as FeatureId, label: "Dashboards avançados" },
    ],
  },
];

// ── Definição dos planos ──────────────────────────────────────────────

export const PLANS: Plan[] = [
  {
    id: "start",
    name: "Start",
    price: 297,
    currency: "R$",
    billingInterval: "month",
    description: "Para clínicas pequenas que estão começando com automação.",
    buttonLabel: "Começar agora",
    buttonVariant: "secondary",
    limits: {
      maxProfessionals: 5,
      maxAdminUsers: 3,
      maxUnits: 1,
      maxWhatsappConversations: 500,
      maxAiInteractions: 200,
      maxConversations: 100,
      // 100k = DEFAULT de clinics.base_token_limit (200 interações x ~500 tokens).
      tokensPerCycle: 100_000,
    },
    features: [
      "agenda",
      "patients",
      "pep",
      "professionals_management",
      "team_management",
      "whatsapp",
      "ai_assistant",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: 697,
    currency: "R$",
    billingInterval: "month",
    description: "Automação completa para clínicas em crescimento.",
    buttonLabel: "Assinar Pro",
    buttonVariant: "primary",
    highlighted: true,
    limits: {
      maxProfessionals: 15,
      maxAdminUsers: 10,
      maxUnits: 1,
      maxWhatsappConversations: 2000,
      maxAiInteractions: 1000,
      maxConversations: 500,
      tokensPerCycle: 500_000,
    },
    features: [
      "agenda",
      "patients",
      "pep",
      "professionals_management",
      "team_management",
      "whatsapp",
      "auto_confirmation",
      "reminders",
      "auto_reschedule",
      "auto_cancel",
      "feedback",
      "return_reminders",
      "ai_assistant",
      "ai_automation",
      "smart_reports",
      "financial_control",
      "financial_reports",
      "indicators",
    ],
  },
  {
    id: "business",
    name: "Business",
    price: 1197,
    currency: "R$",
    billingInterval: "month",
    description: "Gestão multi-unidade para clínicas maiores.",
    buttonLabel: "Assinar Business",
    buttonVariant: "secondary",
    limits: {
      maxProfessionals: 30,
      maxAdminUsers: 25,
      maxUnits: 3,
      maxWhatsappConversations: 5000,
      maxAiInteractions: 3000,
      maxConversations: 2000,
      tokensPerCycle: 1_500_000,
    },
    features: [
      "agenda",
      "patients",
      "pep",
      "professionals_management",
      "units_management",
      "team_management",
      "whatsapp",
      "auto_confirmation",
      "reminders",
      "auto_reschedule",
      "auto_cancel",
      "feedback",
      "return_reminders",
      "ai_assistant",
      "ai_automation",
      "smart_reports",
      "advanced_ai",
      "financial_control",
      "financial_reports",
      "indicators",
      "advanced_dashboards",
      "multi_unit",
      "operational_management",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 1497,
    currency: "R$",
    billingInterval: "month",
    description: "Solução personalizada para grandes clínicas e grupos.",
    buttonLabel: "Falar com especialista",
    buttonVariant: "outline",
    limits: {
      maxProfessionals: Infinity,
      maxAdminUsers: Infinity,
      maxUnits: Infinity,
      maxWhatsappConversations: Infinity,
      maxAiInteractions: Infinity,
      maxConversations: Infinity,
      tokensPerCycle: 10_000_000,
    },
    features: [
      "agenda",
      "patients",
      "pep",
      "professionals_management",
      "units_management",
      "team_management",
      "whatsapp",
      "auto_confirmation",
      "reminders",
      "auto_reschedule",
      "auto_cancel",
      "feedback",
      "return_reminders",
      "ai_assistant",
      "ai_automation",
      "smart_reports",
      "advanced_ai",
      "financial_control",
      "financial_reports",
      "indicators",
      "advanced_dashboards",
      "multi_unit",
      "operational_management",
      "priority_support",
      "custom_config",
    ],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────

export function getPlan(id: PlanId): Plan {
  return PLANS.find((p) => p.id === id) ?? PLANS[0];
}

// ── Mapeamento de produtos LOJOU → plano ──────────────────────────────
// IDs exatos dos produtos registados na LOJOU. Fonte única: o webhook usa-os
// para gravar subscriptions.plan_id da clínica e o checkout usa-os para
// construir o URL de pagamento — garantem que os dois lados coincidem.
export const LOJOU_PLAN_BY_PRICE_ID: Record<string, PlanId> = {
  JzRcy: "start",
  CZqfz: "pro",
  CvPAy: "business",
  Z8cWN: "enterprise",
};

// price_id/product_id recebido no webhook → plano interno.
// undefined quando o ID não corresponde a nenhum produto LOJOU mapeado.
export function getPlanByLojouId(priceId: string): Plan | undefined {
  const planId = LOJOU_PLAN_BY_PRICE_ID[priceId];
  return planId ? getPlan(planId) : undefined;
}

// plan_id interno → ID do produto LOJOU usado no URL de checkout.
export function getLojouIdForPlan(planId: PlanId): string | undefined {
  return Object.entries(LOJOU_PLAN_BY_PRICE_ID).find(([, id]) => id === planId)?.[0];
}

export function formatPrice(price: number, currency = "R$"): string {
  return `${currency} ${price.toLocaleString("pt-BR")}`;
}

export function formatLimit(value: number): string {
  if (!isFinite(value)) return "Personalizado";
  return value.toLocaleString("pt-BR");
}
