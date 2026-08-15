import type { Metadata } from "next";
import { SPECIALTIES } from "@/lib/landing-data";
import SpecialtyPage from "@/components/landing/specialty-page";

export const metadata: Metadata = {
  title: "Agendamento de oftalmologia pelo WhatsApp com IA | SaúdeSync",
  description:
    "Agendamento de oftalmologia. A IA entende o paciente e marca a consulta oftalmológica sozinha pelo WhatsApp. Começar agora no SaúdeSync.",
};

export default function Page() {
  const specialty = SPECIALTIES.find((s) => s.slug === "oftalmologia")!;
  return <SpecialtyPage specialty={specialty} />;
}