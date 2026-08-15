import { listAppointments } from "@/lib/services/appointments";
import { displayDateTime } from "@/lib/datetime";

export const dynamic = "force-dynamic";

export default function ConsultasPage() {
  const appointments = listAppointments();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Consultas</h1>
        <p className="text-sm text-slate-500 mt-1">
          Todas as consultas marcadas, remarcadas e canceladas.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {appointments.length === 0 ? (
          <p className="p-6 text-sm text-slate-400">
            Nenhuma consulta ainda. As consultas agendadas pela IA aparecerão aqui.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-column-header text-left text-white">
                <tr>
                  <th className="px-4 py-3 font-medium">Paciente</th>
                  <th className="px-4 py-3 font-medium">Médico</th>
                  <th className="px-4 py-3 font-medium">Especialidade</th>
                  <th className="px-4 py-3 font-medium">Data e hora</th>
                  <th className="px-4 py-3 font-medium">Valor</th>
                  <th className="px-4 py-3 font-medium">Origem</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((a) => (
                  <tr key={a.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-900">{a.patient_name}</td>
                    <td className="px-4 py-3 text-slate-600">{a.doctor_name}</td>
                    <td className="px-4 py-3 text-slate-600">{a.specialty_name}</td>
                    <td className="px-4 py-3 text-slate-600">{displayDateTime(a.starts_at)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatPrice(a.price)}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {a.source === "ia" ? "IA" : "Manual"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={a.status} rescheduled={a.rescheduled === 1} />
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

function formatPrice(value: number): string {
  return `${value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`;
}

function StatusBadge({ status, rescheduled }: { status: string; rescheduled: boolean }) {
  const map: Record<string, { label: string; className: string }> = {
    scheduled: {
      label: rescheduled ? "Marcada (remarcada)" : "Marcada",
      className: rescheduled ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700",
    },
    cancelled: { label: "Cancelada", className: "bg-red-50 text-red-600" },
    completed: { label: "Concluída", className: "bg-slate-100 text-slate-600" },
  };
  const s = map[status] ?? { label: status, className: "bg-slate-100 text-slate-600" };
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${s.className}`}>
      {s.label}
    </span>
  );
}
