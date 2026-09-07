import { Skeleton, SkeletonCard } from "@/components/skeleton";

export default function ClinicaLoading() {
  return (
    <div className="space-y-6" aria-label="Carregando...">
      <div className="space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  );
}
