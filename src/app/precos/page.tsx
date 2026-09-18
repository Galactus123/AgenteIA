import type { Metadata } from "next";
import PrecosPage from "@/components/pricing/precospage";

export const metadata: Metadata = {
  title: "Planos e Preços | SaúdeSync",
  description: "Planos de gestão clínica com automação via WhatsApp e IA. Escolha o plano ideal para sua clínica.",
};

export default function Precos() {
  return <PrecosPage />;
}
