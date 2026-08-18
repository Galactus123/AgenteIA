import { getStats } from "@/lib/services/stats";
import { displayDate } from "@/lib/datetime";
import AnimatedEntry from "@/components/animated-entry";
import KPICard from "@/components/dashboard/kpi-card";
import AppointmentsList from "@/components/dashboard/appointments-list";
import AppointmentRequestsCard from "@/components/dashboard/appointment-requests-card";
import DoctorStatusList from "@/components/dashboard/doctor-status-list";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  const stats = getStats();
  const today = new Date();
  const dateLabel = displayDate(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`);

  const kpis = [
    { label: "Consultas marcadas", value: stats.scheduled, icon: "🗓", color: "text-primary", bg: "bg-primary/10" },
    { label: "Consultas canceladas", value: stats.cancelled, icon: "✕", color: "text-danger", bg: "bg-danger-light" },
    { label: "Consultas remarcadas", value: stats.rescheduled, icon: "↻", color: "text-warning", bg: "bg-warning-light" },
    { label: "Médicos ativos", value: stats.activeDoctors, icon: "🩺", color: "text-primary", bg: "bg-primary/10" },
    { label: "Conversas com IA", value: stats.totalConversations, icon: "💬", color: "text-success", bg: "bg-success-light" },
    { label: "Mensagens IA", value: stats.botMessages, icon: "🤖", color: "text-highlight", bg: "bg-indigo-50" },
    { label: "Taxa de conversão", value: `${stats.conversionRate}%`, icon: "📈", color: "text-purple-600", bg: "bg-purple-50" },
  ];

  return (
    <AnimatedEntry>
      <div className="space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">Visão geral da clínica e do atendimento com IA.</p>
        </div>

        <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3 sm:gap-4">
          {kpis.map((kpi) => (
            <KPICard
              key={kpi.label}
              label={kpi.label}
              value={kpi.value}
              icon={kpi.icon}
              color={kpi.color}
              bg={kpi.bg}
            />
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
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
