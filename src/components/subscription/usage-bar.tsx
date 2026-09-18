"use client";

interface UsageBarProps {
  label: string;
  current: number;
  limit: number;
  percentage: number;
  icon?: React.ReactNode;
  formatValue?: (v: number) => string;
}

function formatDefault(v: number): string {
  return v.toLocaleString("pt-BR");
}

export default function UsageBar({
  label,
  current,
  limit,
  percentage,
  icon,
  formatValue = formatDefault,
}: UsageBarProps) {
  const isUnlimited = !isFinite(limit) || limit <= 0;
  const isNearLimit = percentage >= 80 && percentage < 100;
  const isAtLimit = percentage >= 100;

  const barColor = isAtLimit
    ? "bg-red-500"
    : isNearLimit
      ? "bg-amber-500"
      : "bg-emerald-500";

  const textColor = isAtLimit
    ? "text-red-600 dark:text-red-400"
    : isNearLimit
      ? "text-amber-600 dark:text-amber-400"
      : "text-emerald-600 dark:text-emerald-400";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon && <span className="text-slate-400">{icon}</span>}
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
        </div>
        <span className={`text-sm font-semibold ${textColor}`}>
          {formatValue(current)} / {isUnlimited ? "Ilimitado" : formatValue(limit)}
        </span>
      </div>
      {!isUnlimited && (
        <div className="h-2 rounded-full bg-slate-100 dark:bg-white/5 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${Math.min(100, percentage)}%` }}
          />
        </div>
      )}
      {isNearLimit && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Você está próximo do limite do seu plano.
        </p>
      )}
      {isAtLimit && (
        <p className="text-xs text-red-600 dark:text-red-400">
          Limite atingido. Faça upgrade para continuar usando.
        </p>
      )}
    </div>
  );
}
