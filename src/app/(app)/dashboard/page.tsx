import { Suspense } from "react";
import { getStats } from "@/lib/services/stats";
import { resolvePageClinicId } from "@/lib/page-auth";
import { displayDate } from "@/lib/datetime";
import { DashboardSkeleton } from "@/components/skeleton";
import {
  Calendar,
  Stethoscope,
  MessageSquare,
  Users,
  Clock,
  FileText,
  CheckCircle2,
  ChevronRight,
  Activity,
  AlertTriangle,
} from "lucide-react";

export const dynamic = "force-dynamic";

const DEFAULT_STATS = {
  scheduled: 0,
  cancelled: 0,
  rescheduled: 0,
  todayScheduled: 0,
  todayCancelled: 0,
  todayRescheduled: 0,
  totalConversations: 0,
  botMessages: 0,
  conversionRate: 0,
  activeDoctors: 0,
  totalPatients: 0,
  todayAppointments: [] as { id: number; patient_name: string; doctor_name: string; specialty_name: string; starts_at: string; status: string }[],
  pendingRequests: [] as { id: number; patient_name: string; patient_phone: string; status: string; updated_at: string }[],
  doctors: [] as { id: string; name: string; specialty_name: string; status: string; schedule: { weekday: number; start_time: string; end_time: string }[] }[],
  errors: [] as string[],
};

function safeDateLabel(): string {
  try {
    const today = new Date();
    return displayDate(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`);
  } catch {
    return "";
  }
}

function safeTime(at: string): string {
  try {
    return at.split(" ")[1] ?? "--:--";
  } catch {
    return "--:--";
  }
}

function updatedLabel(at: string): string {
  try {
    const date = new Date(at);
    if (Number.isNaN(date.getTime())) return "";
    const time = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const isToday = date.toDateString() === new Date().toDateString();
    return isToday ? `hoje às ${time}` : `${date.toLocaleDateString("pt-BR")} às ${time}`;
  } catch {
    return "";
  }
}

interface KpiItem {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  iconClassName: string;
  sub?: string;
}

function IconBox({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <div
      className="p-3 rounded-xl transition-all duration-300 group-hover:scale-110 group-active:scale-95"
      style={{
        background: color,
        boxShadow: `0 0 12px ${color.replace(/[\d.]+\)$/, "0.4)")}`,
      }}
    >
      {children}
    </div>
  );
}

async function DashboardContent() {
  let stats = DEFAULT_STATS;

  try {
    // Sem clínica vinculada não se carrega nada (nunca a "primeira da base").
    const clinicId = await resolvePageClinicId();
    if (!clinicId) throw new Error("Sem clínica vinculada à conta.");

    const loaded = await getStats(clinicId);
    stats = {
      scheduled: loaded?.scheduled ?? 0,
      cancelled: loaded?.cancelled ?? 0,
      rescheduled: loaded?.rescheduled ?? 0,
      todayScheduled: loaded?.todayScheduled ?? 0,
      todayCancelled: loaded?.todayCancelled ?? 0,
      todayRescheduled: loaded?.todayRescheduled ?? 0,
      totalConversations: loaded?.totalConversations ?? 0,
      botMessages: loaded?.botMessages ?? 0,
      conversionRate: loaded?.conversionRate ?? 0,
      activeDoctors: loaded?.activeDoctors ?? 0,
      totalPatients: loaded?.totalPatients ?? 0,
      todayAppointments: Array.isArray(loaded?.todayAppointments) ? loaded.todayAppointments : [],
      pendingRequests: Array.isArray(loaded?.pendingRequests) ? loaded.pendingRequests : [],
      doctors: Array.isArray(loaded?.doctors) ? loaded.doctors : [],
      errors: Array.isArray(loaded?.errors) ? loaded.errors : [],
    };
  } catch (error) {
    console.error("Detalhe do erro no Dashboard:", error);
    stats = { ...DEFAULT_STATS, errors: ["dados gerais do dashboard"] };
  }

  const dateLabel = safeDateLabel();

  const kpis: KpiItem[] = [
    {
      label: "Consultas Hoje",
      value: stats.todayScheduled,
      icon: <Calendar size={20} strokeWidth={1.75} />,
      color: "rgba(79,109,245,0.12)",
      iconClassName: "dark:text-indigo-400 text-indigo-600",
      sub: `${stats.todayCancelled} canceladas · ${stats.todayRescheduled} remarcadas`,
    },
    {
      label: "Médicos Ativos",
      value: stats.activeDoctors,
      icon: <Stethoscope size={20} strokeWidth={1.75} />,
      color: "rgba(16,185,129,0.12)",
      iconClassName: "dark:text-emerald-400 text-emerald-600",
    },
    {
      label: "Atendimentos IA",
      value: stats.totalConversations,
      icon: <MessageSquare size={20} strokeWidth={1.75} />,
      color: "rgba(99,102,241,0.12)",
      iconClassName: "dark:text-indigo-300 text-indigo-500",
    },
    {
      label: "Conversão IA",
      value: `${stats.conversionRate}%`,
      icon: <Activity size={20} strokeWidth={1.75} />,
      color: "rgba(245,158,11,0.12)",
      iconClassName: "dark:text-amber-400 text-amber-600",
    },
    {
      label: "Pacientes",
      value: stats.totalPatients,
      icon: <Users size={20} strokeWidth={1.75} />,
      color: "rgba(168,85,247,0.12)",
      iconClassName: "dark:text-violet-300 text-violet-500",
    },
  ];

  return (
    <div className="relative space-y-4 sm:space-y-6">
      <div className="glow-blob glow-blob-primary w-[300px] h-[300px] -top-32 -right-32 animate-glow-pulse" />
      <div className="glow-blob glow-blob-purple w-[250px] h-[250px] top-1/2 -left-40 animate-glow-pulse" style={{ animationDelay: "1.5s" }} />

      <div className="relative z-10">
        <h1 className="text-lg sm:text-xl font-bold dark:text-white text-slate-900">Dashboard</h1>
        <p className="text-xs sm:text-sm mt-1 dark:text-slate-400 text-slate-500">Visão geral da clínica e do atendimento com IA.</p>
      </div>

      {/* Falhas de leitura do banco (Fase 4.3) */}
      {stats.errors.length > 0 && (
        <div
          role="alert"
          className="relative z-10 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs sm:text-sm text-amber-700 dark:text-amber-300"
        >
          <AlertTriangle size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" />
          <span>
            Alguns indicadores não puderam ser carregados: {stats.errors.join(", ")}. Os valores
            exibidos podem estar incompletos — recarregue a página.
          </span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="relative z-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="group relative overflow-hidden rounded-2xl p-4 sm:p-5 select-none cursor-pointer transition-all duration-300 ease-out hover:-translate-y-1 active:scale-[0.98] hover:shadow-[0_0_25px_rgba(99,102,241,0.3)] active:shadow-[0_0_30px_rgba(99,102,241,0.5)] hover:border-indigo-500/50 active:border-indigo-500/70"
            style={{
              background: "var(--card)",
              border: "1px solid var(--card-border)",
            }}
          >
            <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity duration-300 pointer-events-none"
              style={{ background: "radial-gradient(circle at 50% 0%, rgba(99,102,241,0.08) 0%, transparent 70%)" }}
            />
            <div className="relative flex items-start justify-between">
              <IconBox color={kpi.color}>
                <span className={kpi.iconClassName}>{kpi.icon}</span>
              </IconBox>
            </div>
            <p className="relative text-xl sm:text-2xl font-bold mt-3 dark:text-white text-slate-900">{kpi.value}</p>
            <p className="relative text-xs sm:text-sm mt-1 dark:text-slate-400 text-slate-500">{kpi.label}</p>
            {kpi.sub && (
              <p className="relative text-[11px] mt-1 dark:text-slate-500 text-slate-400">{kpi.sub}</p>
            )}
          </div>
        ))}
      </div>

      {/* Content Grid */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Agenda do dia */}
        <div className="group lg:col-span-2 rounded-2xl p-4 sm:p-6 transition-all duration-300 hover:shadow-[0_0_20px_rgba(99,102,241,0.15)] active:shadow-[0_0_25px_rgba(99,102,241,0.25)] hover:border-indigo-500/30 active:border-indigo-500/50" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <IconBox color="rgba(79,109,245,0.12)">
                <Calendar size={18} strokeWidth={1.75} className="dark:text-indigo-400 text-indigo-600" />
              </IconBox>
              <div>
                <h2 className="font-semibold text-base dark:text-white text-slate-900">Agenda do dia</h2>
                <p className="text-xs mt-0.5 dark:text-slate-400 text-slate-500">{dateLabel}</p>
              </div>
            </div>
            <a href="/consultas" className="flex items-center gap-1 text-xs font-medium transition-colors min-h-[44px] dark:text-indigo-400 text-indigo-600">
              Ver todas <ChevronRight size={14} />
            </a>
          </div>

          {stats.todayAppointments.length === 0 ? (
            <div className="text-center py-8">
                <div className="inline-flex p-3 rounded-xl mb-3" style={{ background: "rgba(99,102,241,0.08)" }}>
                  <FileText size={24} strokeWidth={1.75} className="dark:text-slate-500 text-slate-400" />
                </div>
                <p className="text-sm dark:text-slate-500 text-slate-400">Nenhuma consulta agendada para hoje.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {stats.todayAppointments.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-3 p-3 rounded-xl transition-all duration-200 hover:bg-slate-100 dark:hover:bg-[#1A1D2E] active:bg-slate-200 dark:active:bg-[#1E2235]"
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-semibold shrink-0"
                    style={{ background: "rgba(79,109,245,0.12)" }}
                  >
                    <Clock size={16} strokeWidth={1.75} className="dark:text-indigo-400 text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate dark:text-white text-slate-900">{a.patient_name}</p>
                    <p className="text-xs truncate dark:text-slate-400 text-slate-500">
                      {safeTime(a.starts_at)} · {a.doctor_name} · {a.specialty_name}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${
                      a.status === "scheduled" ? "neon-badge-success" : a.status === "cancelled" ? "neon-badge-danger" : a.status === "no_show" ? "neon-badge-warning" : "neon-badge"
                    }`}
                  >
                    {a.status === "scheduled" ? "Marcada" : a.status === "cancelled" ? "Cancelada" : a.status === "no_show" ? "Não compareceu" : a.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4 sm:space-y-6">
          {/* Aguardando atendimento humano (Fase 4.2) */}
          <div className="group rounded-2xl p-4 sm:p-6 transition-all duration-300 hover:shadow-[0_0_20px_rgba(99,102,241,0.15)] active:shadow-[0_0_25px_rgba(99,102,241,0.25)] hover:border-indigo-500/30 active:border-indigo-500/50" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <IconBox color="rgba(245,158,11,0.12)">
                  <Activity size={18} strokeWidth={1.75} className="dark:text-amber-400 text-amber-600" />
                </IconBox>
                <div>
                  <h2 className="font-semibold text-base dark:text-white text-slate-900">Aguardando atendimento</h2>
                  <p className="text-xs mt-0.5 dark:text-slate-400 text-slate-500">A IA parou de responder</p>
                </div>
              </div>
              <span className="neon-badge-warning text-xs font-medium px-2 py-0.5 rounded-full">
                {stats.pendingRequests.length}
              </span>
            </div>

            {stats.pendingRequests.length === 0 ? (
              <div className="text-center py-6">
                <div className="inline-flex p-3 rounded-xl mb-3" style={{ background: "rgba(16,185,129,0.08)" }}>
                  <CheckCircle2 size={24} strokeWidth={1.75} className="dark:text-emerald-400 text-emerald-600" />
                </div>
                <p className="text-sm dark:text-slate-500 text-slate-400">Nenhuma conversa aguardando atendimento humano.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {stats.pendingRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-3 rounded-xl"
                    style={{ border: "1px solid var(--surface-border)" }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate dark:text-white text-slate-900">
                          {req.patient_name || "Paciente sem nome"}
                        </p>
                        <p className="text-xs mt-0.5 truncate dark:text-slate-400 text-slate-500">
                          {req.patient_phone} · atualizada {updatedLabel(req.updated_at)}
                        </p>
                      </div>
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${
                          req.status === "transferred" ? "neon-badge-warning" : "neon-badge"
                        }`}
                      >
                        {req.status === "transferred" ? "Transferida" : "Cota esgotada"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Médicos */}
          <div className="group rounded-2xl p-4 sm:p-6 transition-all duration-300 hover:shadow-[0_0_20px_rgba(99,102,241,0.15)] active:shadow-[0_0_25px_rgba(99,102,241,0.25)] hover:border-indigo-500/30 active:border-indigo-500/50" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <IconBox color="rgba(16,185,129,0.12)">
                  <Stethoscope size={18} strokeWidth={1.75} className="dark:text-emerald-400 text-emerald-600" />
                </IconBox>
                <h2 className="font-semibold text-base dark:text-white text-slate-900">Médicos</h2>
              </div>
              <a href="/medicos" className="flex items-center gap-1 text-xs font-medium transition-colors min-h-[44px] dark:text-indigo-400 text-indigo-600">
                Ver todos <ChevronRight size={14} />
              </a>
            </div>

            {stats.doctors.length === 0 ? (
              <div className="text-center py-6">
                <div className="inline-flex p-3 rounded-xl mb-3" style={{ background: "rgba(99,102,241,0.08)" }}>
                  <Stethoscope size={24} strokeWidth={1.75} className="dark:text-slate-500 text-slate-400" />
                </div>
                <p className="text-sm dark:text-slate-500 text-slate-400">Nenhum médico encontrado.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {stats.doctors.filter((d) => d.status === "active").slice(0, 5).map((doctor) => (
                  <div key={doctor.id} className="flex items-center gap-3 p-2 rounded-xl transition-all duration-200 hover:bg-slate-100 dark:hover:bg-[#1A1D2E] active:bg-slate-200 dark:active:bg-[#1E2235]">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-semibold shrink-0"
                      style={{ background: "rgba(79,109,245,0.12)" }}
                    >
                      <span className="dark:text-indigo-400 text-indigo-600">{doctor.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate dark:text-white text-slate-900">{doctor.name}</p>
                      <p className="text-xs truncate dark:text-slate-400 text-slate-500">{doctor.specialty_name}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}
