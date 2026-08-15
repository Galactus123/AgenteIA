import type { Metadata } from "next";
import { SPECIALTIES } from "@/lib/landing-data";
import SpecialtyPage from "@/components/landing/specialty-page";

export const metadata: Metadata = {
  title: "Agendamento de laboratórios pelo WhatsApp com IA | SaúdeSync",
  description:
    "Agendamento de laboratórios. A IA entende o paciente e marca coletas e exames sozinha pelo WhatsApp. Começar agora no SaúdeSync.",
};

export default function Page() {
  const specialty = SPECIALTIES.find((s) => s.slug === "laboratorios")!;
  return <SpecialtyPage specialty={specialty} />;
}