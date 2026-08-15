import type { Metadata } from "next";
import { SPECIALTIES } from "@/lib/landing-data";
import SpecialtyPage from "@/components/landing/specialty-page";

export const metadata: Metadata = {
  title: "Agendamento de dermatologia pelo WhatsApp com IA | SaúdeSync",
  description:
    "Agendamento de dermatologia. A IA entende o paciente e marca a consulta dermatológica sozinha pelo WhatsApp. Começar agora no SaúdeSync.",
};

export default function Page() {
  const specialty = SPECIALTIES.find((s) => s.slug === "dermatologia")!;
  return <SpecialtyPage specialty={specialty} />;
}