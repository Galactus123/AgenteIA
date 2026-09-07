"use client";

import { useEffect, useState, useCallback } from "react";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Bell,
  BellOff,
  X,
  CheckCheck,
} from "lucide-react";

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

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; className: string; iconColor: string }> = {
  scheduled: {
    icon: <CheckCircle2 size={14} strokeWidth={1.75} />,
    className: "neon-badge-success",
    iconColor: "#34d399",
  },
  cancelled: {
    icon: <XCircle size={14} strokeWidth={1.75} />,
    className: "neon-badge-danger",
    iconColor: "#f87171",
  },
  rescheduled: {
    icon: <Clock size={14} strokeWidth={1.75} />,
    className: "neon-badge-warning",
    iconColor: "#fbbf24",
  },
  reminder: {
    icon: <Bell size={14} strokeWidth={1.75} />,
    className: "neon-badge",
    iconColor: "#818cf8",
  },
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
      <div
        className="fixed inset-x-0 top-0 sm:inset-auto sm:top-16 sm:right-6 sm:w-96 z-50 sm:rounded-2xl max-h-[100dvh] sm:max-h-[70vh] flex flex-col"
        style={{
          background: "var(--card)",
          border: "1px solid var(--card-border)",
          backdropFilter: "blur(20px)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
        }}
      >
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--surface-border)" }}>
          <div className="flex items-center gap-2.5">
            <div
              className="p-1.5 rounded-lg"
              style={{ background: "rgba(79,109,245,0.12)" }}
            >
              <Bell size={16} strokeWidth={1.75} style={{ color: "#818cf8" }} />
            </div>
            <h3 className="font-semibold text-sm dark:text-white text-slate-900">Notificações</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={markAllRead}
              className="flex items-center gap-1.5 text-xs font-medium min-h-[32px] px-2 rounded-lg hover:opacity-80"
              style={{ color: "var(--color-highlight)" }}
            >
              <CheckCheck size={14} strokeWidth={1.75} />
              Marcar todas lidas
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:opacity-80 min-w-[32px] min-h-[32px] flex items-center justify-center dark:text-slate-500 text-slate-400"
              aria-label="Fechar"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex gap-1 px-3 py-2 overflow-x-auto" style={{ borderBottom: "1px solid var(--surface-border)" }}>
          {(Object.keys(FILTER_LABELS) as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full whitespace-nowrap transition-all duration-150 min-h-[32px] ${
                filter === f ? "" : "hover:opacity-80 dark:text-slate-400 text-slate-500"
              }`}
              style={filter === f ? {
                background: "linear-gradient(135deg, rgba(79,109,245,0.2), rgba(129,140,248,0.1))",
                color: "#4f6df5",
                border: "1px solid rgba(99,102,241,0.2)",
              } : {
                border: "1px solid transparent",
              }}
            >
              {FILTER_LABELS[f]}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <span className="text-sm dark:text-slate-500 text-slate-400">Carregando...</span>
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex p-3 rounded-xl mb-3" style={{ background: "rgba(99,102,241,0.08)" }}>
                <BellOff size={24} strokeWidth={1.75} className="dark:text-slate-500 text-slate-400" />
              </div>
              <p className="text-sm dark:text-slate-500 text-slate-400">Nenhuma notificação.</p>
            </div>
          ) : (
            <div style={{ borderBottom: "1px solid var(--surface-border)" }}>
              {notifications.map((n) => {
                const config = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.scheduled;
                return (
                  <button
                    key={n.id}
                    onClick={() => !n.read && markRead(n.id)}
                    className={`w-full text-left px-4 py-3 flex gap-3 transition-colors min-h-[60px]`}
                    style={{
                      background: !n.read ? "var(--neon-blue)" : "transparent",
                    }}
                    onMouseEnter={(e) => { if (n.read) e.currentTarget.style.background = "var(--surface)"; }}
                    onMouseLeave={(e) => { if (n.read) e.currentTarget.style.background = "transparent"; }}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                      style={{ background: `rgba(${config.iconColor === "#34d399" ? "52,211,153" : config.iconColor === "#f87171" ? "248,113,113" : config.iconColor === "#fbbf24" ? "251,191,36" : "129,140,248"},0.12)` }}
                    >
                      <span style={{ color: config.iconColor }}>{config.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm font-medium truncate ${!n.read ? "dark:text-white text-slate-900" : "dark:text-slate-300 text-slate-600"}`}>
                          {n.title}
                        </p>
                        <span className="text-[10px] shrink-0 mt-0.5 dark:text-slate-500 text-slate-400">
                          {timeAgo(n.created_at)}
                        </span>
                      </div>
                      <p className="text-xs mt-0.5 line-clamp-2 dark:text-slate-400 text-slate-500">{n.message}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${config.className}`}>
                          {FILTER_LABELS[n.type as FilterType] ?? n.type}
                        </span>
                        {n.channel_status === "sent" && (
                          <span className="text-[10px] flex items-center gap-1 dark:text-slate-500 text-slate-400">
                            <CheckCircle2 size={10} strokeWidth={2} /> Enviado
                          </span>
                        )}
                        {n.channel_status === "failed" && (
                          <span className="text-[10px] flex items-center gap-1 text-danger">
                            <XCircle size={10} strokeWidth={2} /> Falha envio
                          </span>
                        )}
                      </div>
                    </div>
                    {!n.read && (
                      <span
                        className="w-2 h-2 rounded-full shrink-0 mt-2"
                        style={{
                          background: "#4f6df5",
                          boxShadow: "0 0 8px rgba(79,109,245,0.6)",
                        }}
                      />
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
