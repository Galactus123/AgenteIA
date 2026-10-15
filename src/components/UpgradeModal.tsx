"use client";

import { useEffect } from "react";
import { ArrowRight, Check, Sparkles, X } from "lucide-react";
import { getCheckoutLink } from "@/lib/checkout-links";

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Planos apresentados no modal (preços alinhados com src/lib/plans.ts).
const PLANS = [
  {
    id: "start" as const,
    name: "Start",
    price: "R$ 297",
    cadence: "/mês",
    description: "Para clínicas pequenas que estão começando com automação.",
    featured: false,
  },
  {
    id: "pro" as const,
    name: "Pro",
    price: "R$ 697",
    cadence: "/mês",
    description: "Automação completa para clínicas em crescimento.",
    featured: true,
  },
];

// Modal de upgrade em modo de visualização: bloqueia a ação e oferece os
// checkouts diretos da LOJOU (env NEXT_PUBLIC_LINK_CHECKOUT_LOJOU_*);
// sem link configurado, cai para a página de preços.
export default function UpgradeModal({ isOpen, onClose }: UpgradeModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-[#0B0D14]/95 p-7 shadow-2xl shadow-black/60 backdrop-blur-xl sm:p-8">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-indigo-500/25 blur-3xl"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -left-12 bottom-0 h-36 w-36 rounded-full bg-violet-500/20 blur-3xl"
        />

        <button
          onClick={onClose}
          aria-label="Fechar"
          className="absolute right-4 top-4 z-10 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X size={18} />
        </button>

        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-1 text-xs font-semibold text-indigo-300 backdrop-blur-md">
            <Sparkles size={13} />
            Modo de visualização
          </span>

          <h3
            id="upgrade-modal-title"
            className="mt-4 text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent sm:text-2xl"
          >
            Funcionalidade Exclusiva para Assinantes
          </h3>

          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            Você está no modo de visualização. Assine um dos nossos planos para libertar o envio
            de mensagens, criação de agendamentos e gestão completa da sua clínica.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {PLANS.map((plan) => {
              const checkoutUrl = getCheckoutLink(plan.id) ?? "/precos";
              const isExternal = /^https?:\/\//i.test(checkoutUrl);
              return (
                <a
                  key={plan.id}
                  href={checkoutUrl}
                  {...(isExternal
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {})}
                  onClick={onClose}
                  className={`group relative flex flex-col rounded-2xl border p-5 transition duration-300 hover:-translate-y-0.5 ${
                    plan.featured
                      ? "border-indigo-400/40 bg-gradient-to-br from-indigo-500/15 via-white/[0.04] to-violet-500/10 shadow-lg shadow-indigo-500/15 hover:border-indigo-400/60"
                      : "border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/[0.07]"
                  }`}
                >
                  {plan.featured && (
                    <span className="absolute -top-2.5 right-4 rounded-full border border-white/10 bg-white/10 px-2.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-md">
                      Mais popular
                    </span>
                  )}

                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-white">Plano {plan.name}</p>
                    <span className="text-lg font-bold text-white">
                      {plan.price}
                      <span className="text-xs font-medium text-slate-400">{plan.cadence}</span>
                    </span>
                  </div>

                  <p className="mt-2 text-xs leading-relaxed text-slate-400">
                    {plan.description}
                  </p>

                  <ul className="mt-3 space-y-1.5">
                    <li className="flex items-center gap-2 text-xs text-slate-300">
                      <Check size={13} className="shrink-0 text-indigo-300" />
                      Agenda, pacientes e PEP
                    </li>
                    <li className="flex items-center gap-2 text-xs text-slate-300">
                      <Check size={13} className="shrink-0 text-indigo-300" />
                      WhatsApp com IA
                    </li>
                  </ul>

                  <span
                    className={`mt-4 flex items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-xs font-semibold transition duration-300 ${
                      plan.featured
                        ? "bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] text-white shadow-lg shadow-indigo-500/25 group-hover:brightness-110"
                        : "border border-white/10 bg-white/5 text-slate-200 group-hover:bg-white/10"
                    }`}
                  >
                    Assinar {plan.name}
                    <ArrowRight size={13} />
                  </span>
                </a>
              );
            })}
          </div>

          <button
            onClick={onClose}
            className="mt-5 w-full rounded-full px-4 py-2.5 text-xs font-medium text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-200"
          >
            Continuar em modo de visualização
          </button>
        </div>
      </div>
    </div>
  );
}
