export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-xl ${className}`}
      style={{ background: "rgba(255,255,255,0.05)" }}
      aria-hidden="true"
    />
  );
}

export function SkeletonText({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2.5 ${className}`} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 animate-pulse rounded-lg"
          style={{
            background: "rgba(255,255,255,0.05)",
            width: i === lines - 1 ? "60%" : "100%",
          }}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div className={`neon-card p-6 ${className}`} aria-hidden="true">
      <div className="flex items-center gap-4 mb-4">
        <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <SkeletonText lines={2} />
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="neon-card overflow-hidden" aria-hidden="true">
      {/* Header */}
      <div className="flex gap-4 px-4 py-3" style={{ background: "rgba(255,255,255,0.03)" }}>
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, row) => (
        <div key={row} className="flex gap-4 px-4 py-3" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          {Array.from({ length: cols }).map((_, col) => (
            <Skeleton key={col} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-label="Carregando dashboard...">
      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
      {/* Content area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <div className="space-y-4">
          <SkeletonCard />
        </div>
      </div>
    </div>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-6" aria-label="Carregando...">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <SkeletonTable rows={rows} cols={5} />
    </div>
  );
}
