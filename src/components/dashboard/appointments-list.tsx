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
    scheduled: { label: "Marcada", className: "neon-badge-success" },
    cancelled: { label: "Cancelada", className: "neon-badge-danger" },
    completed: { label: "Concluída", className: "neon-badge" },
  };
  const s = map[status] ?? { label: status, className: "neon-badge" };
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
  const list = Array.isArray(appointments) ? appointments : [];
  return (
    <div className="neon-card p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4 sm:mb-5">
        <div>
          <h2 className="font-semibold text-base" style={{ color: "var(--text-primary)" }}>Agenda do dia</h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{dateLabel}</p>
        </div>
        <a
          href="/consultas"
          className="text-xs font-medium text-highlight hover:text-primary transition-colors min-h-[44px] flex items-center"
        >
          Ver todas →
        </a>
      </div>

      {list.length === 0 ? (
        <div className="text-center py-8 sm:py-10">
          <span className="text-3xl block mb-2">📋</span>
          <p className="text-sm" style={{ color: "var(--text-faint)" }}>Nenhuma consulta agendada para hoje.</p>
        </div>
      ) : (
        <div className="space-y-1.5 sm:space-y-2">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
          >
            {list.map((a) => (
              <motion.div
                key={a.id}
                className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 sm:p-3 rounded-xl transition-colors min-h-[56px]"
                style={{ background: "transparent" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                variants={rowVariants}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                <div className="flex items-center gap-3 sm:flex-1 sm:min-w-0">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-primary text-sm font-semibold shrink-0"
                    style={{ background: "var(--neon-blue)" }}
                  >
                    {a.starts_at.split(" ")[1]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{a.patient_name}</p>
                    <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
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
