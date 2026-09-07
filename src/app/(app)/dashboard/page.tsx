import { Suspense } from "react";
import { DashboardSkeleton } from "@/components/skeleton";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <div className="relative space-y-6">
        <div className="relative z-10">
          <h1 className="text-lg sm:text-xl font-bold text-white">Dashboard</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">Visão geral da clínica e do atendimento com IA.</p>
        </div>
        <p className="text-sm text-slate-500">Painel carregado com sucesso.</p>
      </div>
    </Suspense>
  );
}
