"use client";

import { useEffect, useState, useCallback } from "react";

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  appointment_id: number | null;
  read: number;
  channel_status: string;
  created_at: string;
}

type FilterType = "all" | "scheduled" | "cancelled" | "rescheduled" | "reminder";

const TYPE_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
  scheduled: { icon: "🟢", color: "text-success", bg: "bg-success-light" },
  cancelled: { icon: "🔴", color: "text-danger", bg: "bg-danger-light" },
  rescheduled: { icon: "🟡", color: "text-warning", bg: "bg-warning-light" },
  reminder: { icon: "🔵", color: "text-primary", bg: "bg-primary/10" },
};

const FILTER_LABELS: Record<FilterType, string> = {
  all: "Todas",
  scheduled: "Agendamentos",
  cancelled: "Cancelamentos",
  rescheduled: "Remarcações",
  reminder: "Lembretes",
};

function timeAgo(dateStr: string): string {
  const now = new Date();
  const d = new Date(dateStr.replace(" ", "T"));
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `${diffMin}min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD}d`;
}

interface NotificationPanelProps {
  onClose: () => void;
}

export default function NotificationPanel({ onClose }: NotificationPanelProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<FilterType>("all");
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(() => {
    const params = new URLSearchParams();
    if (filter !== "all") params.set("type", filter);
    params.set("limit", "30");

    fetch(`/api/notifications?${params}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setNotifications(data.notifications);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [filter]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  async function markRead(id: number) {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: 1 } : n))
    );
    fetch(`/api/notifications/${id}`, { method: "PATCH" }).catch(() => {});
  }

  async function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: 1 })));
    fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "read_all" }),
    }).catch(() => {});
  }

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden="true" />
      <div className="fixed inset-x-0 top-0 sm:inset-auto sm:top-16 sm:right-6 sm:w-96 z-50 bg-white sm:rounded-2xl sm:border sm:border-slate-200 sm:shadow-xl max-h-[100dvh] sm:max-h-[70vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900 text-sm">Notificações</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={markAllRead}
              className="text-xs text-primary hover:text-primary-dark font-medium min-h-[32px] px-2"
            >
              Marcar todas lidas
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 min-w-[32px] min-h-[32px] flex items-center justify-center"
              aria-label="Fechar"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex gap-1 px-3 py-2 border-b border-slate-100 overflow-x-auto">
          {(Object.keys(FILTER_LABELS) as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full whitespace-nowrap transition-colors min-h-[32px] ${
                filter === f
                  ? "bg-primary text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {FILTER_LABELS[f]}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <span className="text-sm text-slate-400">Carregando...</span>
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-12">
              <span className="text-3xl block mb-2">🔕</span>
              <p className="text-sm text-slate-400">Nenhuma notificação.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {notifications.map((n) => {
                const config = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.scheduled;
                return (
                  <button
                    key={n.id}
                    onClick={() => !n.read && markRead(n.id)}
                    className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-slate-50 transition-colors min-h-[60px] ${
                      !n.read ? "bg-primary/5" : ""
                    }`}
                  >
                    <span className={`w-8 h-8 rounded-full ${config.bg} flex items-center justify-center text-sm shrink-0 mt-0.5`}>
                      {config.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm font-medium ${!n.read ? "text-slate-900" : "text-slate-700"} truncate`}>
                          {n.title}
                        </p>
                        <span className="text-[10px] text-slate-400 shrink-0 mt-0.5">
                          {timeAgo(n.created_at)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${config.bg} ${config.color}`}>
                          {FILTER_LABELS[n.type as FilterType] ?? n.type}
                        </span>
                        {n.channel_status === "sent" && (
                          <span className="text-[10px] text-slate-400">✓ Enviado</span>
                        )}
                        {n.channel_status === "failed" && (
                          <span className="text-[10px] text-danger">Falha envio</span>
                        )}
                      </div>
                    </div>
                    {!n.read && (
                      <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
