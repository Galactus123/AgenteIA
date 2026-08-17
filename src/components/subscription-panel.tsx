"use client";

import { useEffect, useState } from "react";

interface SubscriptionAlert {
  id: number;
  type: string;
  message: string;
  created_at: string;
}

interface SubscriptionData {
  subscription: {
    token_limit: number;
    base_token_limit: number;
    current_token_usage: number;
    near_limit_notified: number;
    overage_blocks_purchased: number;
    subscription_status: string;
    usagePercent: number;
    quotaExhausted: boolean;
    nearLimit: boolean;
  };
  alerts: SubscriptionAlert[];
}

function formatTokens(value: number): string {
  return value.toLocaleString("pt-BR");
}

export default function SubscriptionPanel() {
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [buying, setBuying] = useState(false);
  const [message, setMessage] = useState("");

  const load = () => {
    fetch("/api/subscription")
      .then((res) => (res.ok ? res.json() : null))
      .then(setData);
  };

  useEffect(() => {
    load();
  }, []);

  async function buyPack() {
    if (!window.confirm("Adquirir um pacote excedente de 50.000 tokens? O valor será faturado na próxima cobrança.")) {
      return;
    }
    setBuying(true);
    setMessage("");
    try {
      const res = await fetch("/api/subscription/buy-overage-pack", { method: "POST" });
      const json = await res.json();
      if (res.ok) {
        setMessage("Pacote excedente adquirido. O atendimento automático por IA foi reativado.");
      } else {
        setMessage(json.error ?? "Falha ao adquirir o pacote excedente.");
      }
      load();
    } catch {
      setMessage("Falha de conexão ao adquirir o pacote excedente.");
    } finally {
      setBuying(false);
    }
  }

  if (!data) return null;

  const sub = data.subscription;
  const width = `${Math.min(100, sub.usagePercent)}%`;
  const recentAlerts = data.alerts.filter((a) => a.type !== "cycle_reset").slice(0, 3);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-slate-900">Cota de tokens da IA</h2>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            sub.quotaExhausted
              ? "bg-red-100 text-red-700"
              : sub.nearLimit
                ? "bg-amber-100 text-amber-700"
                : "bg-emerald-100 text-emerald-700"
          }`}
        >
          {sub.quotaExhausted
            ? "Cota esgotada"
            : sub.nearLimit
              ? "Cota próxima do fim"
              : sub.subscription_status === "active"
                ? "IA ativa"
                : "Pausado"}
        </span>
      </div>

      <div>
        <div className="flex justify-between text-sm text-slate-600 mb-1">
          <span>
            {formatTokens(sub.current_token_usage)} de {formatTokens(sub.token_limit)} tokens
          </span>
          <span>{sub.usagePercent}%</span>
        </div>
        <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              sub.quotaExhausted ? "bg-red-500" : sub.nearLimit ? "bg-amber-500" : "bg-teal-500"
            }`}
            style={{ width }}
          />
        </div>
      </div>

      {sub.quotaExhausted && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          A cota de tokens foi atingida. O atendimento automático por IA está pausado e as novas conversas estão sendo
          transferidas para a recepção. Adquira um pacote excedente para reativar.
        </div>
      )}

      {!sub.quotaExhausted && sub.nearLimit && !sub.near_limit_notified && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
          A cota mensal está próxima do fim ({sub.usagePercent}% utilizados). Considere adquirir um pacote excedente.
        </div>
      )}

      {message && <p className="text-sm text-slate-700">{message}</p>}

      <button
        onClick={buyPack}
        disabled={buying}
        className="rounded-lg bg-primary hover:bg-primary-dark text-white font-medium px-4 py-2 text-sm disabled:opacity-50 transition-colors"
      >
        {buying ? "Processando..." : "Comprar pacote excedente (+50.000 tokens)"}
      </button>

      <p className="text-xs text-slate-400">
        Blocos excedentes no ciclo atual: {sub.overage_blocks_purchased}. Cota base do plano:{" "}
        {formatTokens(sub.base_token_limit)} tokens.
      </p>

      {recentAlerts.length > 0 && (
        <div className="space-y-2">
          {recentAlerts.map((a) => (
            <div
              key={a.id}
              className={`rounded-lg border px-3 py-2 text-sm ${
                a.type === "quota_exhausted"
                  ? "bg-red-50 border-red-200 text-red-700"
                  : a.type === "near_limit"
                    ? "bg-amber-50 border-amber-200 text-amber-700"
                    : "bg-slate-50 border-slate-200 text-slate-600"
              }`}
            >
              {a.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}