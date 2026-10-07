import type { Metadata } from "next";
import PrecosPage from "@/components/pricing/precospage";
import { type PlanId } from "@/lib/plans";

export const metadata: Metadata = {
  title: "Planos e Preços | SaúdeSync",
  description: "Planos de gestão clínica com automação via WhatsApp e IA. Escolha o plano ideal para sua clínica.",
};

// `?plan=` chega do login (next=/precos?plan=...) quando o utilizador clicou
// "Assinar" sem sessão: o cliente retoma o checkout automaticamente.
export default async function Precos({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string | string[] }>;
}) {
  const params = await searchParams;
  const planParam = Array.isArray(params.plan) ? params.plan[0] : params.plan;
  const resumable: PlanId[] = ["start", "pro", "business"];
  const resumePlan =
    planParam && resumable.includes(planParam as PlanId) ? (planParam as PlanId) : null;

  return <PrecosPage resumePlan={resumePlan} />;
}
