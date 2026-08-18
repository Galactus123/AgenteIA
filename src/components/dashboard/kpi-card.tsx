interface KPICardProps {
  label: string;
  value: string | number;
  icon: string;
  trend?: { value: number; label: string };
  color: string;
  bg: string;
  border?: string;
}

export default function KPICard({ label, value, icon, trend, color, bg, border = "border-slate-100" }: KPICardProps) {
  return (
    <div className={`bg-white rounded-2xl border ${border} p-5 shadow-sm hover:shadow-md transition-shadow`}>
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center text-lg`}>
          {icon}
        </div>
        {trend && (
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              trend.value >= 0 ? "bg-success-light text-success" : "bg-danger-light text-danger"
            }`}
          >
            {trend.value >= 0 ? "↑" : "↓"} {Math.abs(trend.value)}%
          </span>
        )}
      </div>
      <p className={`text-2xl font-bold mt-3 ${color}`}>{value}</p>
      <p className="text-sm text-slate-500 mt-1">{label}</p>
    </div>
  );
}
