import type { Metadata } from "next";
import { SPECIALTIES } from "@/lib/landing-data";
import SpecialtyPage from "@/components/landing/specialty-page";

export const metadata: Metadata = {
  title: `Agendamento de clínica geral pelo WhatsApp com IA | SaúdeSync`,
  description:
    "Agendamento automático para consultas de clínica geral pelo WhatsApp. A IA entende o paciente e marca a consulta sozinha. Começar agora no SaúdeSync.",
};

export default function Page() {
  const specialty = SPECIALTIES.find((s) => s.slug === "clinica-geral")!;
  return <SpecialtyPage specialty={specialty} />;
}