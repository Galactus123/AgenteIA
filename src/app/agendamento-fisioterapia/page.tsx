import type { Metadata } from "next";
import { SPECIALTIES } from "@/lib/landing-data";
import SpecialtyPage from "@/components/landing/specialty-page";

export const metadata: Metadata = {
  title: "Agendamento de fisioterapia pelo WhatsApp com IA | SaúdeSync",
  description:
    "Agendamento de fisioterapia. A IA entende o paciente e marca as sessões sozinha pelo WhatsApp. Começar agora no SaúdeSync.",
};

export default function Page() {
  const specialty = SPECIALTIES.find((s) => s.slug === "fisioterapia")!;
  return <SpecialtyPage specialty={specialty} />;
}