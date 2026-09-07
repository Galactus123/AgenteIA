import { Suspense } from "react";
import { getStats } from "@/lib/services/stats";
import { displayDate } from "@/lib/datetime";
import { DashboardSkeleton } from "@/components/skeleton";

export const dynamic = "force-dynamic";

const DEFAULT_STATS = {
  scheduled: 0,
  cancelled: 0,
  rescheduled: 0,
  totalConversations: 0,
  botMessages: 0,
  conversionRate: 0,
  activeDoctors: 0,
  totalPatients: 0,
  todayAppointments: [] as { id: number; patient_name: string; doctor_name: string; specialty_name: string; starts_at: string; status: string }[],
  pendingRequests: [] as { id: number; patient_name: string; patient_phone: string; specialty_name: string; preferred_date: string; preferred_time: string; reason: string; source: string; created_at: string }[],
  doctors: [] as { id: number; name: string; specialty_name: string; status: string; schedule: { weekday: number; start_time: string; end_time: string }[] }[],
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

function DashboardContent() {
  let stats = DEFAULT_STATS;

  try {
    const loaded = getStats();
    stats = {
      scheduled: loaded?.scheduled ?? 0,
      cancelled: loaded?.cancelled ?? 0,
      rescheduled: loaded?.rescheduled ?? 0,
      totalConversations: loaded?.totalConversations ?? 0,
      botMessages: loaded?.botMessages ?? 0,
      conversionRate: loaded?.conversionRate ?? 0,
      activeDoctors: loaded?.activeDoctors ?? 0,
      totalPatients: loaded?.totalPatients ?? 0,
      todayAppointments: Array.isArray(loaded?.todayAppointments) ? loaded.todayAppointments : [],
      pendingRequests: Array.isArray(loaded?.pendingRequests) ? loaded.pendingRequests : [],
      doctors: Array.isArray(loaded?.doctors) ? loaded.doctors : [],
    };
  } catch (error) {
    console.error("Detalhe do erro no Dashboard:", error);
  }

  const dateLabel = safeDateLabel();

  return (
    <div className="relative space-y-4 sm:space-y-6">
      <div className="glow-blob glow-blob-primary w-[300px] h-[300px] -top-32 -right-32 animate-glow-pulse" />
      <div className="glow-blob glow-blob-purple w-[250px] h-[250px] top-1/2 -left-40 animate-glow-pulse" style={{ animationDelay: "1.5s" }} />

      <div className="relative z-10">
        <h1 className="text-lg sm:text-xl font-bold" style={{ color: "var(--text-primary)" }}>Dashboard</h1>
        <p className="text-xs sm:text-sm mt-1" style={{ color: "var(--text-muted)" }}>Visão geral da clínica e do atendimento com IA.</p>
      </div>

      {/* KPI Cards */}
      <div className="relative z-10 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: "Consultas Hoje", value: stats.scheduled, icon: "🗓", glow: "rgba(79,109,245,0.15)" },
          { label: "Médicos Ativos", value: stats.activeDoctors, icon: "🩺", glow: "rgba(16,185,129,0.15)" },
          { label: "Atendimentos IA", value: stats.totalConversations, icon: "💬", glow: "rgba(129,140,248,0.15)" },
          { label: "Pacientes", value: stats.totalPatients, icon: "👥", glow: "rgba(168,85,247,0.15)" },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="p-4 sm:p-5 rounded-2xl transition-all duration-300"
            style={{
              background: "var(--card)",
              border: "1px solid var(--card-border)",
              boxShadow: "0 0 15px rgba(99,102,241,0.15)",
            }}
          >
            <div className="flex items-start justify-between">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"
                style={{ background: kpi.glow }}
              >
                {kpi.icon}
              </div>
            </div>
            <p className="text-xl sm:text-2xl font-bold mt-3" style={{ color: "var(--text-primary)" }}>{kpi.value}</p>
            <p className="text-xs sm:text-sm mt-1" style={{ color: "var(--text-muted)" }}>{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Content Grid */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Agenda do dia */}
        <div className="lg:col-span-2 rounded-2xl p-4 sm:p-6" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-base" style={{ color: "var(--text-primary)" }}>Agenda do dia</h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{dateLabel}</p>
            </div>
            <a href="/consultas" className="text-xs font-medium transition-colors min-h-[44px] flex items-center" style={{ color: "var(--color-highlight)" }}>
              Ver todas →
            </a>
          </div>

          {stats.todayAppointments.length === 0 ? (
            <div className="text-center py-8">
              <span className="text-3xl block mb-2">📋</span>
              <p className="text-sm" style={{ color: "var(--text-faint)" }}>Nenhuma consulta agendada para hoje.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {stats.todayAppointments.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-3 p-3 rounded-xl transition-colors"
                  style={{ background: "transparent" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0"
                    style={{ background: "var(--neon-blue)", color: "var(--color-primary)" }}
                  >
                    {safeTime(a.starts_at)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{a.patient_name}</p>
                    <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                      {a.doctor_name} · {a.specialty_name}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${
                      a.status === "scheduled" ? "neon-badge-success" : a.status === "cancelled" ? "neon-badge-danger" : "neon-badge"
                    }`}
                  >
                    {a.status === "scheduled" ? "Marcada" : a.status === "cancelled" ? "Cancelada" : a.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4 sm:space-y-6">
          {/* Solicitações */}
          <div className="rounded-2xl p-4 sm:p-6" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-base" style={{ color: "var(--text-primary)" }}>Solicitações</h2>
              <span className="neon-badge-warning text-xs font-medium px-2 py-0.5 rounded-full">
                {stats.pendingRequests.length}
              </span>
            </div>

            {stats.pendingRequests.length === 0 ? (
              <div className="text-center py-6">
                <span className="text-3xl block mb-2">✅</span>
                <p className="text-sm" style={{ color: "var(--text-faint)" }}>Nenhuma solicitação pendente.</p>
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
                        <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{req.patient_name}</p>
                        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                          {req.specialty_name} · {req.preferred_date} {req.preferred_time}
                        </p>
                      </div>
                      <span className="neon-badge text-xs shrink-0">
                        {req.source === "ia" ? "IA" : "Web"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Médicos */}
          <div className="rounded-2xl p-4 sm:p-6" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-base" style={{ color: "var(--text-primary)" }}>Médicos</h2>
              <a href="/medicos" className="text-xs font-medium transition-colors min-h-[44px] flex items-center" style={{ color: "var(--color-highlight)" }}>
                Ver todos →
              </a>
            </div>

            {stats.doctors.length === 0 ? (
              <div className="text-center py-6">
                <span className="text-3xl block mb-2">🩺</span>
                <p className="text-sm" style={{ color: "var(--text-faint)" }}>Nenhum médico encontrado.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {stats.doctors.filter((d) => d.status === "active").slice(0, 5).map((doctor) => (
                  <div key={doctor.id} className="flex items-center gap-3 p-2 rounded-xl" style={{ background: "transparent" }}>
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
                      style={{ background: "var(--neon-blue)", color: "var(--color-primary)" }}
                    >
                      {doctor.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{doctor.name}</p>
                      <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{doctor.specialty_name}</p>
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
