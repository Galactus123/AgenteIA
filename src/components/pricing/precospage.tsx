"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, ArrowRight, MessageCircle, Sparkles, Zap } from "lucide-react";
import { PLANS, FEATURE_CATEGORIES, formatLimit, type PlanId, type FeatureId } from "@/lib/plans";

const planOrder: PlanId[] = ["start", "pro", "business", "enterprise"];

const planColors: Record<PlanId, { bg: string; border: string; accent: string; badge: string }> = {
  start: {
    bg: "bg-white dark:bg-[#161926]",
    border: "border-slate-200 dark:border-[rgba(99,102,241,0.12)]",
    accent: "text-teal-600 dark:text-teal-400",
    badge: "bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-300",
  },
  pro: {
    bg: "bg-white dark:bg-[#161926]",
    border: "border-indigo-500 dark:border-indigo-400",
    accent: "text-indigo-600 dark:text-indigo-400",
    badge: "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
  },
  business: {
    bg: "bg-white dark:bg-[#161926]",
    border: "border-slate-200 dark:border-[rgba(99,102,241,0.12)]",
    accent: "text-violet-600 dark:text-violet-400",
    badge: "bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300",
  },
  enterprise: {
    bg: "bg-white dark:bg-[#161926]",
    border: "border-slate-200 dark:border-[rgba(99,102,241,0.12)]",
    accent: "text-amber-600 dark:text-amber-400",
    badge: "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
};

const featureLabels: Record<FeatureId, string> = {
  agenda: "Agenda inteligente",
  patients: "Cadastro de pacientes",
  pep: "PEP / Prontuário",
  professionals_management: "Gestão de profissionais",
  units_management: "Gestão de unidades",
  team_management: "Gestão de equipe",
  whatsapp: "WhatsApp",
  auto_confirmation: "Confirmação automática",
  reminders: "Lembretes",
  auto_reschedule: "Reagendamento automático",
  auto_cancel: "Cancelamento automático",
  feedback: "Feedback",
  return_reminders: "Lembretes de retorno",
  ai_assistant: "Assistente IA",
  ai_automation: "Automação com IA",
  smart_reports: "Relatórios inteligentes",
  advanced_ai: "IA avançada",
  financial_control: "Controle financeiro",
  financial_reports: "Relatórios financeiros",
  indicators: "Indicadores",
  advanced_dashboards: "Dashboards avançados",
  multi_unit: "Multi-unidade",
  operational_management: "Gestão operacional",
  priority_support: "Suporte prioritário",
  custom_config: "Configurações personalizadas",
};

interface PrecosPageProps {
  // Plano devolvido pelo login (?plan=...): retoma o checkout interrompido.
  resumePlan?: PlanId | null;
}

export default function PrecosPage({ resumePlan = null }: PrecosPageProps) {
  const router = useRouter();
  const [loadingPlan, setLoadingPlan] = useState<PlanId | null>(null);
  const [errorPlan, setErrorPlan] = useState<{ plan: PlanId; message: string } | null>(null);
  const resumedRef = useRef(false);

  // CTA → /api/subscription/checkout → redireciona para o pagamento da LOJOU.
  // Sem sessão (401) leva o utilizador ao login e devolve-o aqui com o plano
  // escolhido, para o checkout retomar sozinho após autenticar.
  const startCheckout = useCallback(
    async (planId: PlanId, fromResume: boolean) => {
      setLoadingPlan(planId);
      setErrorPlan(null);
      try {
        const res = await fetch("/api/subscription/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planId }),
        });
        const data = await res.json().catch(() => null);

        if (res.status === 401) {
          // Retomada já autenticada e ainda assim 401: não há loop — mostra erro.
          if (fromResume) {
            setErrorPlan({ plan: planId, message: "Sessão expirada. Entre novamente para continuar." });
          } else {
            router.push(`/login?next=${encodeURIComponent(`/precos?plan=${planId}`)}`);
          }
          return;
        }

        if (!res.ok || data?.type !== "checkout" || !data?.checkoutUrl) {
          setErrorPlan({
            plan: planId,
            message: data?.error ?? "Não foi possível iniciar o checkout. Tente novamente.",
          });
          return;
        }

        // Destino externo (hosting de pagamento da LOJOU): navegação total.
        window.location.href = data.checkoutUrl as string;
      } catch {
        setErrorPlan({
          plan: planId,
          message: "Falha de ligação. Verifique a internet e tente novamente.",
        });
      } finally {
        setLoadingPlan(null);
      }
    },
    [router]
  );

  // Retoma pós-login: /precos?plan=pro vindo de /login?next=...
  useEffect(() => {
    if (!resumePlan || resumedRef.current) return;
    resumedRef.current = true;
    void startCheckout(resumePlan, true);
  }, [resumePlan, startCheckout]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B0D14]">
      {/* Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-violet-500/5 dark:from-indigo-500/10 dark:via-transparent dark:to-violet-500/10" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-16 pb-12 sm:pt-24 sm:pb-16">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 dark:bg-indigo-500/10 px-4 py-1.5 mb-6">
              <Zap size={14} className="text-indigo-600 dark:text-indigo-400" />
              <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 tracking-wide uppercase">
                Planos e Preços
              </span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 dark:text-white tracking-tight">
              Escolha o plano ideal para sua clínica
            </h1>
            <p className="mt-4 text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">
              Automação completa via WhatsApp com IA. Agendamento, confirmação,
              lembretes e gestão inteligente — tudo em um só lugar.
            </p>
          </div>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 -mt-4 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {planOrder.map((planId) => {
            const plan = PLANS.find((p) => p.id === planId)!;
            const colors = planColors[planId];
            const isHighlighted = plan.highlighted;

            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl border-2 p-6 sm:p-7 transition-all duration-200 ${colors.bg} ${colors.border} ${
                  isHighlighted
                    ? "shadow-lg shadow-indigo-500/10 dark:shadow-indigo-500/20 scale-[1.02]"
                    : "shadow-sm hover:shadow-md"
                }`}
              >
                {isHighlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-4 py-1 text-xs font-semibold text-white shadow-sm">
                      <Sparkles size={12} />
                      Mais popular
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">{plan.name}</h3>
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${colors.badge}`}>
                    {plan.id === "enterprise" ? "Personalizado" : "Mensal"}
                  </span>
                </div>

                <p className="text-sm text-slate-500 dark:text-slate-400 mb-5 min-h-[40px]">
                  {plan.description}
                </p>

                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{plan.currency}</span>
                    <span className="text-4xl font-bold text-slate-900 dark:text-white">
                      {plan.price.toLocaleString("pt-BR")}
                    </span>
                    <span className="text-sm text-slate-500 dark:text-slate-400">/{plan.billingInterval === "month" ? "mês" : plan.billingInterval}</span>
                  </div>
                </div>

                {/* Limits */}
                <div className="space-y-2.5 mb-6 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Profissionais</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-200">{formatLimit(plan.limits.maxProfessionals)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Usuários admin</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-200">{formatLimit(plan.limits.maxAdminUsers)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Unidades</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-200">{formatLimit(plan.limits.maxUnits)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <MessageCircle size={13} /> WhatsApp/mês
                    </span>
                    <span className="font-semibold text-slate-700 dark:text-slate-200">{formatLimit(plan.limits.maxWhatsappConversations)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <Sparkles size={13} /> IA/mês
                    </span>
                    <span className="font-semibold text-slate-700 dark:text-slate-200">{formatLimit(plan.limits.maxAiInteractions)}</span>
                  </div>
                </div>

                {/* Features */}
                <ul className="space-y-2 mb-7">
                  {plan.features.slice(0, 8).map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                      <Check size={16} className={`mt-0.5 shrink-0 ${colors.accent}`} />
                      {featureLabels[f]}
                    </li>
                  ))}
                  {plan.features.length > 8 && (
                    <li className="text-xs text-slate-400 dark:text-slate-500 pl-6">
                      +{plan.features.length - 8} outros recursos
                    </li>
                  )}
                </ul>

                {/* CTA */}
                {plan.id === "enterprise" ? (
                  <a
                    href="mailto:contato@saudesync.com.br?subject=Plano%20Enterprise%20-%20Solicita%C3%A7%C3%A3o"
                    className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-indigo-500 dark:border-indigo-400 px-6 py-3 text-sm font-semibold text-indigo-600 dark:text-indigo-400 transition-colors hover:bg-indigo-50 dark:hover:bg-indigo-500/10"
                  >
                    Falar com especialista
                    <ArrowRight size={16} />
                  </a>
                ) : (
                  <div>
                    <button
                      type="button"
                      onClick={() => void startCheckout(plan.id, false)}
                      disabled={loadingPlan !== null}
                      className={`flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-wait ${
                        isHighlighted
                          ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
                          : plan.buttonVariant === "primary"
                            ? "bg-indigo-600 text-white hover:bg-indigo-700"
                            : "bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-white/10"
                      }`}
                    >
                      {loadingPlan === plan.id ? "Abrindo checkout..." : plan.buttonLabel}
                      <ArrowRight size={16} />
                    </button>
                    {errorPlan?.plan === plan.id && (
                      <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-400">
                        {errorPlan.message}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Comparison Table */}
        <div className="mt-20">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
              Comparação completa dos planos
            </h2>
            <p className="mt-2 text-slate-500 dark:text-slate-400">
              Veja todos os recursos incluídos em cada plano
            </p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-[rgba(99,102,241,0.12)] bg-white dark:bg-[#161926] shadow-sm">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-slate-200 dark:border-[rgba(99,102,241,0.12)]">
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900 dark:text-white w-[260px]">
                    Recurso
                  </th>
                  {planOrder.map((pid) => {
                    const p = PLANS.find((pl) => pl.id === pid)!;
                    return (
                      <th key={pid} className="px-4 py-4 text-center">
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">{p.name}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {pid === "enterprise" ? "Sob consulta" : `R$ ${p.price}/mês`}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {/* Limits row */}
                <tr className="bg-slate-50 dark:bg-white/[0.02]">
                  <td className="px-6 py-3 text-sm font-semibold text-slate-900 dark:text-white" colSpan={5}>
                    Limites do plano
                  </td>
                </tr>
                {[
                  { label: "Profissionais de saúde", key: "maxProfessionals" as const },
                  { label: "Usuários administrativos", key: "maxAdminUsers" as const },
                  { label: "Unidades", key: "maxUnits" as const },
                  { label: "WhatsApp/mês", key: "maxWhatsappConversations" as const },
                  { label: "IA/mês", key: "maxAiInteractions" as const },
                ].map((row) => (
                  <tr key={row.key} className="border-b border-slate-100 dark:border-[rgba(99,102,241,0.06)]">
                    <td className="px-6 py-3 text-sm text-slate-600 dark:text-slate-300">{row.label}</td>
                    {planOrder.map((pid) => {
                      const plan = PLANS.find((p) => p.id === pid)!;
                      const val = plan.limits[row.key];
                      return (
                        <td key={pid} className="px-4 py-3 text-center text-sm font-medium text-slate-700 dark:text-slate-200">
                          {formatLimit(val)}
                        </td>
                      );
                    })}
                  </tr>
                ))}

                {/* Feature categories */}
                {FEATURE_CATEGORIES.map((cat) => (
                  <>
                    <tr key={`cat-${cat.name}`} className="bg-slate-50 dark:bg-white/[0.02]">
                      <td className="px-6 py-3 text-sm font-semibold text-slate-900 dark:text-white" colSpan={5}>
                        {cat.name}
                      </td>
                    </tr>
                    {cat.features.map((feat) => (
                      <tr key={feat.id} className="border-b border-slate-100 dark:border-[rgba(99,102,241,0.06)]">
                        <td className="px-6 py-3 text-sm text-slate-600 dark:text-slate-300">{feat.label}</td>
                        {planOrder.map((pid) => {
                          const plan = PLANS.find((p) => p.id === pid)!;
                          const has = plan.features.includes(feat.id);
                          return (
                            <td key={pid} className="px-4 py-3 text-center">
                              {has ? (
                                <Check size={16} className="inline text-emerald-500" />
                              ) : (
                                <X size={16} className="inline text-slate-300 dark:text-slate-600" />
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-20 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white text-center mb-8">
            Perguntas frequentes
          </h2>
          <div className="space-y-4">
            {[
              {
                q: "Posso mudar de plano depois?",
                r: "Sim. Você pode fazer upgrade a qualquer momento. O downgrade é verificado para garantir que sua clínica não ultrapasse os limites do novo plano.",
              },
              {
                q: "O que acontece se eu atingir o limite de WhatsApp ou IA?",
                r: "Quando o limite é atingido, o sistema exibe um aviso profissional com opção de upgrade. Você pode continuar usando o sistema normalmente para outras funcionalidades.",
              },
              {
                q: "Profissionais de saúde e usuários administrativos são a mesma coisa?",
                r: "Não. Profissionais de saúde (médicos, dentistas, etc.) ocupam vagas diferentes de usuários administrativos (recepcionistas, gestores). Uma clínica no plano Start pode ter 5 profissionais + 3 administrativos.",
              },
              {
                q: "Como funciona o checkout?",
                r: "O pagamento é processado de forma segura pela LOJOU. Após a confirmação do pagamento, sua assinatura é ativada automaticamente e os recursos do plano são liberados.",
              },
              {
                q: "Preciso pagar para usar?",
                r: "Sim. O acesso à plataforma — incluindo o agente de WhatsApp — é liberado assim que o pagamento da assinatura é confirmado, sem período gratuito.",
              },
            ].map((item) => (
              <details key={item.q} className="group rounded-xl border border-slate-200 dark:border-[rgba(99,102,241,0.12)] bg-white dark:bg-[#161926] overflow-hidden">
                <summary className="flex items-center justify-between px-6 py-4 cursor-pointer text-sm font-semibold text-slate-900 dark:text-white list-none">
                  {item.q}
                  <span className="ml-4 text-slate-400 group-open:rotate-180 transition-transform">▾</span>
                </summary>
                <div className="px-6 pb-4 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  {item.r}
                </div>
              </details>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="mt-16 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Sem taxa de setup. Cancele quando quiser.
          </p>
          {/* Bottom CTA: checkout do plano destacado (sem funil de trial —
              401 leva ao login e retoma o checkout aqui após autenticar). */}
          <button
            type="button"
            onClick={() =>
              void startCheckout(
                PLANS.find((p) => p.highlighted)?.id ?? "start",
                false
              )
            }
            disabled={loadingPlan !== null}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-8 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 shadow-sm disabled:opacity-60 disabled:cursor-wait"
          >
            {loadingPlan !== null ? "Abrindo checkout..." : "Começar agora"}
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
