import type { Metadata } from "next";
import { SPECIALTIES } from "@/lib/landing-data";
import SpecialtyPage from "@/components/landing/specialty-page";

export const metadata: Metadata = {
  title: "Agendamento de ginecologia pelo WhatsApp com IA | SaúdeSync",
  description:
    "Agendamento de ginecologia. A IA entende o paciente e marca a consulta ginecológica sozinha pelo WhatsApp. Começar agora no SaúdeSync.",
};

export default function Page() {
  const specialty = SPECIALTIES.find((s) => s.slug === "ginecologia")!;
  return <SpecialtyPage specialty={specialty} />;
}