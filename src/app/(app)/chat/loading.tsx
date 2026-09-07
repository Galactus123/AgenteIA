import { Skeleton, SkeletonCard } from "@/components/skeleton";

export default function ChatLoading() {
  return (
    <div className="flex flex-col h-full" aria-label="Carregando...">
      <div className="flex items-center gap-4 mb-4">
        <Skeleton className="h-7 w-32" />
      </div>
      <div className="flex-1 rounded-2xl p-4 space-y-4" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
        <div className="flex gap-3">
          <Skeleton className="h-10 w-10 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-16 w-3/4 rounded-2xl" />
          </div>
        </div>
        <div className="flex gap-3 flex-row-reverse">
          <Skeleton className="h-10 w-10 rounded-full shrink-0" />
          <div className="flex-1 space-y-2 flex flex-col items-end">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-12 w-2/3 rounded-2xl" />
          </div>
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-10 w-10 rounded-full shrink-0" />
          <Skeleton className="h-20 w-1/2 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
