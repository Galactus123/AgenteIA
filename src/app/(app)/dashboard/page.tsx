import { Suspense } from "react";
import { getStats } from "@/lib/services/stats";
import { displayDate } from "@/lib/datetime";
import AnimatedEntry from "@/components/animated-entry";
import KPICard from "@/components/dashboard/kpi-card";
import AppointmentsList from "@/components/dashboard/appointments-list";
import AppointmentRequestsCard from "@/components/dashboard/appointment-requests-card";
import DoctorStatusList from "@/components/dashboard/doctor-status-list";
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
  todayAppointments: [] as { id: number; patient_name: string; doctor_name: string; specialty_name: string; starts_at: string; status: string }[],
  pendingRequests: [] as { id: number; patient_name: string; patient_phone: string; specialty_name: string; preferred_date: string; preferred_time: string; reason: string; source: string; created_at: string }[],
  doctors: [] as { id: number; name: string; specialty_name: string; status: string; schedule: { weekday: number; start_time: string; end_time: string }[] }[],
};

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
      todayAppointments: Array.isArray(loaded?.todayAppointments) ? loaded.todayAppointments : [],
      pendingRequests: Array.isArray(loaded?.pendingRequests) ? loaded.pendingRequests : [],
      doctors: Array.isArray(loaded?.doctors) ? loaded.doctors : [],
    };
  } catch (error) {
    console.error("Detalhe do erro no Dashboard:", error);
  }

  const today = new Date();
  const dateLabel = displayDate(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`);

  const kpis = [
    { label: "Consultas marcadas", value: stats.scheduled, icon: "🗓", color: "text-primary", glow: "rgba(79,109,245,0.12)" },
    { label: "Consultas canceladas", value: stats.cancelled, icon: "✕", color: "text-danger", glow: "rgba(239,68,68,0.12)" },
    { label: "Consultas remarcadas", value: stats.rescheduled, icon: "↻", color: "text-warning", glow: "rgba(245,158,11,0.12)" },
    { label: "Médicos ativos", value: stats.activeDoctors, icon: "🩺", color: "text-primary", glow: "rgba(79,109,245,0.12)" },
    { label: "Conversas com IA", value: stats.totalConversations, icon: "💬", color: "text-success", glow: "rgba(16,185,129,0.12)" },
    { label: "Mensagens IA", value: stats.botMessages, icon: "🤖", color: "text-highlight", glow: "rgba(129,140,248,0.12)" },
    { label: "Taxa de conversão", value: `${stats.conversionRate}%`, icon: "📈", color: "text-purple-400", glow: "rgba(168,85,247,0.12)" },
  ];

  return (
    <AnimatedEntry>
      <div className="relative space-y-4 sm:space-y-6">
        {/* Ambient glow blobs */}
        <div className="glow-blob glow-blob-primary w-[300px] h-[300px] -top-32 -right-32 animate-glow-pulse" />
        <div className="glow-blob glow-blob-purple w-[250px] h-[250px] top-1/2 -left-40 animate-glow-pulse" style={{ animationDelay: "1.5s" }} />

        <div className="relative z-10">
          <h1 className="text-lg sm:text-xl font-bold text-white">Dashboard</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">Visão geral da clínica e do atendimento com IA.</p>
        </div>

        {/* KPI Grid */}
        <div className="relative z-10 grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3 sm:gap-4">
          {kpis.map((kpi) => (
            <KPICard
              key={kpi.label}
              label={kpi.label}
              value={kpi.value}
              icon={kpi.icon}
              color={kpi.color}
              glowColor={kpi.glow}
            />
          ))}
        </div>

        {/* Content grid */}
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          <div className="lg:col-span-2">
            <AppointmentsList
              appointments={stats.todayAppointments}
              dateLabel={dateLabel}
            />
          </div>

          <div className="space-y-4 sm:space-y-6">
            <AppointmentRequestsCard requests={stats.pendingRequests} />
            <DoctorStatusList doctors={stats.doctors} />
          </div>
        </div>
      </div>
    </AnimatedEntry>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}
