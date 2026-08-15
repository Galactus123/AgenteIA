import type { Metadata } from "next";
import { SPECIALTIES } from "@/lib/landing-data";
import SpecialtyPage from "@/components/landing/specialty-page";

export const metadata: Metadata = {
  title: "Agendamento de psicologia pelo WhatsApp com IA | SaúdeSync",
  description:
    "Agendamento de psicologia. A IA entende o paciente e marca a consulta psicológica sozinha pelo WhatsApp. Começar agora no SaúdeSync.",
};

export default function Page() {
  const specialty = SPECIALTIES.find((s) => s.slug === "psicologia")!;
  return <SpecialtyPage specialty={specialty} />;
}