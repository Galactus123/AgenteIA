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

export default function AnimatedTableRows({ appointments }: { appointments: Appointment[] }) {
  return (
    <motion.tbody
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
    >
      {appointments.map((a) => (
        <motion.tr
          key={a.id}
          className="border-b border-slate-50"
          variants={rowVariants}
          transition={{ duration: 0.25, ease: "easeOut" }}
        >
          <td className="py-2.5 text-slate-700">{a.starts_at.split(" ")[1]}</td>
          <td className="py-2.5 font-medium text-slate-900">{a.patient_name}</td>
          <td className="py-2.5 text-slate-600">{a.doctor_name}</td>
          <td className="py-2.5 text-slate-600">{a.specialty_name}</td>
          <td className="py-2.5">
            <StatusBadge status={a.status} />
          </td>
        </motion.tr>
      ))}
    </motion.tbody>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    scheduled: { label: "Marcada", className: "bg-emerald-50 text-emerald-700" },
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
