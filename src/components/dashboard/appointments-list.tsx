"use client";

import { motion } from "framer-motion";

interface Appointment {
  id: number;
  patient_name: string;
  doctor_name: string;
  specialty_name: string;
  starts_at: string;
  status: string;
}

const rowVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    scheduled: { label: "Marcada", className: "bg-emerald-50 text-emerald-700" },
    cancelled: { label: "Cancelada", className: "bg-red-50 text-red-600" },
    completed: { label: "Concluída", className: "bg-slate-100 text-slate-600" },
  };
  const s = map[status] ?? { label: status, className: "bg-slate-100 text-slate-600" };
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${s.className}`}>
      {s.label}
    </span>
  );
}

interface AppointmentsListProps {
  appointments: Appointment[];
  dateLabel: string;
}

export default function AppointmentsList({ appointments, dateLabel }: AppointmentsListProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4 sm:mb-5">
        <div>
          <h2 className="font-semibold text-slate-900 text-base">Agenda do dia</h2>
          <p className="text-xs text-slate-500 mt-0.5">{dateLabel}</p>
        </div>
        <a
          href="/consultas"
          className="text-xs font-medium text-primary hover:text-primary-dark transition-colors min-h-[44px] flex items-center"
        >
          Ver todas →
        </a>
      </div>

      {appointments.length === 0 ? (
        <div className="text-center py-8 sm:py-10">
          <span className="text-3xl block mb-2">📋</span>
          <p className="text-sm text-slate-400">Nenhuma consulta agendada para hoje.</p>
        </div>
      ) : (
        <div className="space-y-1.5 sm:space-y-2">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
          >
            {appointments.map((a) => (
              <motion.div
                key={a.id}
                className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 sm:p-3 rounded-xl hover:bg-slate-50 transition-colors min-h-[56px]"
                variants={rowVariants}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                {/* Mobile: stacked layout */}
                <div className="flex items-center gap-3 sm:flex-1 sm:min-w-0">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-semibold shrink-0">
                    {a.starts_at.split(" ")[1]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{a.patient_name}</p>
                    <p className="text-xs text-slate-500 truncate">
                      {a.doctor_name} · {a.specialty_name}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 pl-[52px] sm:pl-0">
                  <StatusBadge status={a.status} />
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      )}
    </div>
  );
}
