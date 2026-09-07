import { SkeletonCard } from "@/components/skeleton";

export default function PerfilLoading() {
  return (
    <div className="space-y-6" aria-label="Carregando...">
      <SkeletonCard />
      <SkeletonCard />
    </div>
  );
}
