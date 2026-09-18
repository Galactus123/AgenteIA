"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CreditCard,
  Users,
  Stethoscope,
  Building2,
  MessageCircle,
  Sparkles,
  ArrowRight,
  Calendar,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import UsageBar from "@/components/subscription/usage-bar";
import PlanBadge from "@/components/subscription/plan-badge";

interface PlanData {
  plan: {
    id: string;
    name: string;
    price: number;
    currency: string;
    billingInterval: string;
    description: string;
    features: string[];
  };
  subscription: {
    status: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: number;
  } | null;
  usage: {
    plan: { id: string; name: string; price: number; currency: string };
    professionals: { current: number; limit: number; percentage: number };
    adminUsers: { current: number; limit: number; percentage: number };
    units: { current: number; limit: number; percentage: number };
    whatsapp: { current: number; limit: number; percentage: number };
    ai: { current: number; limit: number; percentage: number };
  };
}

function formatLimit(v: number): string {
  if (!isFinite(v) || v <= 0) return "Personalizado";
  return v.toLocaleString("pt-BR");
}

function formatDate(d: string): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return d;
  }
}

export default function AssinaturaPage() {
  const [data, setData] = useState<PlanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  useEffect(() => {
    fetch("/api/subscription/plan")
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  async function handleCheckout() {
    if (!data) return;
    setCheckoutLoading(true);
    try {
      const res = await fetch("/api/subscription/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: data.plan.id === "enterprise" ? "enterprise" : data.plan.id }),
      });
      const json = await res.json();
      if (json.type === "checkout" && json.checkoutUrl) {
        window.location.href = json.checkoutUrl;
      } else if (json.type === "contact") {
        window.location.href = json.contactUrl;
      }
    } catch {
      // silently fail
    } finally {
      setCheckoutLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-slate-200 dark:bg-white/5 rounded-lg" />
        <div className="h-40 bg-slate-200 dark:bg-white/5 rounded-2xl" />
        <div className="h-64 bg-slate-200 dark:bg-white/5 rounded-2xl" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-500 dark:text-slate-400">Erro ao carregar dados da assinatura.</p>
      </div>
    );
  }

  const { plan, subscription, usage } = data;
  const status = subscription?.status ?? "none";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Assinatura</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Gerencie seu plano e acompanhe o consumo de recursos.
        </p>
      </div>

      {/* Current Plan Card */}
      <div className="rounded-2xl border border-slate-200 dark:border-[rgba(99,102,241,0.12)] bg-white dark:bg-[#161926] p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">{plan.name}</h2>
              <PlanBadge planName={plan.name} status={status} />
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">{plan.description}</p>
          </div>
          <div className="text-right">
            <div className="flex items-baseline gap-1">
              <span className="text-sm text-slate-500 dark:text-slate-400">{plan.currency}</span>
              <span className="text-3xl font-bold text-slate-900 dark:text-white">
                {plan.price.toLocaleString("pt-BR")}
              </span>
              <span className="text-sm text-slate-500 dark:text-slate-400">/mês</span>
            </div>
          </div>
        </div>

        {subscription && (
          <div className="flex flex-wrap gap-4 text-sm text-slate-600 dark:text-slate-300 mb-6 pb-6 border-b border-slate-100 dark:border-[rgba(99,102,241,0.06)]">
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-slate-400" />
              <span>
                Renovação: <strong>{formatDate(subscription.currentPeriodEnd)}</strong>
              </span>
            </div>
            {subscription.cancelAtPeriodEnd === 1 && (
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <AlertTriangle size={14} />
                <span>Cancelamento agendado para o fim do período</span>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/precos"
            className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
          >
            <CreditCard size={16} />
            {subscription?.status === "active" ? "Alterar plano" : "Assinar agora"}
            <ArrowRight size={14} />
          </Link>
          {plan.id !== "enterprise" && (
            <a
              href="mailto:contato@saudesync.com.br?subject=Solicita%C3%A7%C3%A3o%20de%20suporte"
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-[rgba(99,102,241,0.12)] px-5 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 transition-colors hover:bg-slate-50 dark:hover:bg-white/5"
            >
              <ExternalLink size={14} />
              Falar com suporte
            </a>
          )}
        </div>
      </div>

      {/* Usage Dashboard */}
      <div className="rounded-2xl border border-slate-200 dark:border-[rgba(99,102,241,0.12)] bg-white dark:bg-[#161926] p-6 sm:p-8">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Uso do plano</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <UsageBar
            label="Profissionais"
            current={usage.professionals.current}
            limit={usage.professionals.limit}
            percentage={usage.professionals.percentage}
            icon={<Stethoscope size={16} />}
          />
          <UsageBar
            label="Usuários administrativos"
            current={usage.adminUsers.current}
            limit={usage.adminUsers.limit}
            percentage={usage.adminUsers.percentage}
            icon={<Users size={16} />}
          />
          <UsageBar
            label="Unidades"
            current={usage.units.current}
            limit={usage.units.limit}
            percentage={usage.units.percentage}
            icon={<Building2 size={16} />}
          />
          <UsageBar
            label="WhatsApp (conversas/mês)"
            current={usage.whatsapp.current}
            limit={usage.whatsapp.limit}
            percentage={usage.whatsapp.percentage}
            icon={<MessageCircle size={16} />}
          />
          <UsageBar
            label="IA (interações/mês)"
            current={usage.ai.current}
            limit={usage.ai.limit}
            percentage={usage.ai.percentage}
            icon={<Sparkles size={16} />}
          />
        </div>
      </div>

      {/* Plan Features */}
      <div className="rounded-2xl border border-slate-200 dark:border-[rgba(99,102,241,0.12)] bg-white dark:bg-[#161926] p-6 sm:p-8">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Recursos incluídos</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {plan.features.map((f) => (
            <div key={f} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 py-1">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              {f.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
            </div>
          ))}
        </div>
      </div>

      {/* Checkout Loading Overlay */}
      {checkoutLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#161926] rounded-2xl p-8 text-center">
            <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-slate-600 dark:text-slate-300">Redirecionando para o checkout...</p>
          </div>
        </div>
      )}
    </div>
  );
}
