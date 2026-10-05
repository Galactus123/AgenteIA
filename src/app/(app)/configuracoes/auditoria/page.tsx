"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, RefreshCw, Inbox } from "lucide-react";

interface AuditEvent {
  id: number;
  action: string;
  actor_label: string | null;
  entity: string | null;
  entity_id: string | null;
  meta: Record<string, unknown> | null;
  ip: string | null;
  created_at: string;
}

const ACTION_STYLES: Record<string, string> = {
  auth: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300",
  appointment: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300",
  patient: "bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300",
  professional: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300",
  specialty: "bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300",
  clinic: "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300",
};

function actionStyle(action: string): string {
  const prefix = action.split(".")[0];
  return (
    ACTION_STYLES[prefix] ??
    "bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-300"
  );
}

function metaSummary(meta: Record<string, unknown> | null): string {
  if (!meta) return "—";
  const entries = Object.entries(meta);
  if (entries.length === 0) return "—";
  return entries
    .slice(0, 4)
    .map(([k, v]) => `${k}: ${String(v).slice(0, 60)}`)
    .join(" · ");
}

export default function AuditoriaPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Busca sem mexer em `loading` (a chamada de efeito só fecha o skeleton).
  const fetchEvents = () =>
    fetch("/api/audit?limit=200")
      .then(async (r) => {
        if (!r.ok) throw new Error("Falha ao carregar a auditoria.");
        const body = (await r.json()) as { events: AuditEvent[] };
        setEvents(body.events ?? []);
        setError(null);
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Erro inesperado.")
      );

  const refresh = () => {
    setLoading(true);
    void fetchEvents().finally(() => setLoading(false));
  };

  useEffect(() => {
    void fetchEvents().finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck size={22} className="text-indigo-500" />
            Auditoria
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Registro de atividades: autenticações e alterações de dados da clínica.
          </p>
        </div>
        <button
          onClick={refresh}
          className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-[rgba(99,102,241,0.12)] px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 transition-colors hover:bg-slate-50 dark:hover:bg-white/5"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : undefined} />
          Atualizar
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-rose-200 dark:border-rose-500/20 bg-rose-50 dark:bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300"
        >
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 dark:border-[rgba(99,102,241,0.12)] bg-white dark:bg-[#161926] overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3 animate-pulse">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-6 bg-slate-200 dark:bg-white/5 rounded-lg" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Inbox size={32} />
            <p className="mt-3 text-sm">Nenhum evento registrado ainda.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-[rgba(99,102,241,0.12)] text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  <th className="px-4 py-3 font-medium">Data/hora</th>
                  <th className="px-4 py-3 font-medium">Ação</th>
                  <th className="px-4 py-3 font-medium">Ator</th>
                  <th className="px-4 py-3 font-medium">Entidade</th>
                  <th className="px-4 py-3 font-medium">Detalhes</th>
                  <th className="px-4 py-3 font-medium">IP</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr
                    key={e.id}
                    className="border-b border-slate-100 dark:border-[rgba(99,102,241,0.06)] last:border-0"
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600 dark:text-slate-300">
                      {e.created_at}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-lg px-2 py-0.5 text-xs font-medium ${actionStyle(e.action)}`}
                      >
                        {e.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                      {e.actor_label ?? "sistema"}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {e.entity ?? "—"}
                      {e.entity_id ? ` #${e.entity_id}` : ""}
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 max-w-[280px] truncate">
                      {metaSummary(e.meta)}
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {e.ip ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
