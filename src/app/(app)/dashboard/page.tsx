import { getStats } from "@/lib/services/stats";
import { todayStr } from "@/lib/datetime";
import AnimatedEntry from "@/components/animated-entry";
import AnimatedTableRows from "@/components/animated-table-rows";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  const stats = getStats();
  const today = todayStr();

  const cards = [
    { label: "Consultas marcadas", value: stats.scheduled, color: "text-teal-700", bg: "bg-teal-50" },
    { label: "Consultas canceladas", value: stats.cancelled, color: "text-red-600", bg: "bg-red-50" },
    { label: "Consultas remarcadas", value: stats.rescheduled, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "Médicos ativos", value: stats.activeDoctors, color: "text-indigo-600", bg: "bg-indigo-50" },
    { label: "Conversas com a IA", value: stats.totalConversations, color: "text-emerald-700", bg: "bg-emerald-50" },
    { label: "Mensagens atendidas pela IA", value: stats.botMessages, color: "text-cyan-700", bg: "bg-cyan-50" },
    { label: "Taxa de conversão", value: `${stats.conversionRate}%`, color: "text-purple-700", bg: "bg-purple-50" },
  ];

  return (
    <AnimatedEntry>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Visão geral da clínica e do atendimento com IA.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {cards.map((card) => (
            <div key={card.label} className={`rounded-2xl ${card.bg} border border-slate-100 p-5`}>
              <p className={`text-3xl font-bold ${card.color}`}>{card.value}</p>
              <p className="text-sm text-slate-600 mt-1">{card.label}</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900">Agenda de hoje</h2>
            <span className="text-xs text-slate-400">{today}</span>
          </div>
          {stats.todayAppointments.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhuma consulta agendada para hoje.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-column-header text-left text-white">
                    <th className="px-3 py-2 font-medium">Horário</th>
                    <th className="px-3 py-2 font-medium">Paciente</th>
                    <th className="px-3 py-2 font-medium">Médico</th>
                    <th className="px-3 py-2 font-medium">Especialidade</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatedTableRows appointments={stats.todayAppointments} />
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AnimatedEntry>
  );
}
