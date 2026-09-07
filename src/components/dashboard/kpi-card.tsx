interface KPICardProps {
  label: string;
  value: string | number;
  icon: string;
  trend?: { value: number; label: string };
  color: string;
  glowColor?: string;
}

export default function KPICard({ label, value, icon, trend, color, glowColor = "rgba(79,109,245,0.12)" }: KPICardProps) {
  return (
    <div
      className="neon-card p-4 sm:p-5 min-h-[100px] relative overflow-hidden group"
      role="article"
      aria-label={`${label}: ${value}`}
    >
      {/* Subtle glow blob inside card */}
      <div
        className="absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-40 group-hover:opacity-70 transition-opacity duration-500 pointer-events-none"
        style={{ background: glowColor, filter: "blur(30px)" }}
      />

      <div className="relative z-10">
        <div className="flex items-start justify-between">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"
            style={{ background: glowColor }}
          >
            {icon}
          </div>
          {trend && (
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                trend.value >= 0 ? "neon-badge-success" : "neon-badge-danger"
              }`}
            >
              {trend.value >= 0 ? "↑" : "↓"} {Math.abs(trend.value)}%
            </span>
          )}
        </div>
        <p className={`text-xl sm:text-2xl font-bold mt-3 ${color}`}>{value}</p>
        <p className="text-xs sm:text-sm text-slate-400 mt-1 leading-tight">{label}</p>
      </div>
    </div>
  );
}
