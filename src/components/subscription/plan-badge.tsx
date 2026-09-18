"use client";

interface PlanBadgeProps {
  planName: string;
  status?: string;
  size?: "sm" | "md" | "lg";
}

const planStyles: Record<string, string> = {
  Start: "bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-500/20",
  Pro: "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/20",
  Business: "bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-500/20",
  Enterprise: "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/20",
};

const statusStyles: Record<string, string> = {
  active: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  trialing: "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300",
  past_due: "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300",
  canceled: "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300",
  unpaid: "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300",
  none: "bg-slate-50 dark:bg-slate-500/10 text-slate-500 dark:text-slate-400",
};

const statusLabels: Record<string, string> = {
  active: "Ativa",
  trialing: "Período de teste",
  past_due: "Pagamento atrasado",
  canceled: "Cancelada",
  unpaid: "Não paga",
  none: "Sem assinatura",
};

const sizeClasses = {
  sm: "text-[10px] px-2 py-0.5",
  md: "text-xs px-2.5 py-1",
  lg: "text-sm px-3 py-1.5",
};

export default function PlanBadge({ planName, status, size = "md" }: PlanBadgeProps) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-flex items-center rounded-full font-semibold border ${planStyles[planName] ?? planStyles.Start} ${sizeClasses[size]}`}
      >
        {planName}
      </span>
      {status && (
        <span
          className={`inline-flex items-center rounded-full font-medium ${statusStyles[status] ?? statusStyles.none} ${sizeClasses[size]}`}
        >
          {statusLabels[status] ?? status}
        </span>
      )}
    </div>
  );
}
