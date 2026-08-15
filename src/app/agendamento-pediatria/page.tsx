import type { Metadata } from "next";
import { SPECIALTIES } from "@/lib/landing-data";
import SpecialtyPage from "@/components/landing/specialty-page";

export const metadata: Metadata = {
  title: "Agendamento de pediatria pelo WhatsApp com IA | SaúdeSync",
  description:
    "Agendamento de pediatria. A IA entende os sintomas da criança e marca a consulta com o pediatra sozinha pelo WhatsApp. Começar agora no SaúdeSync.",
};

export default function Page() {
  const specialty = SPECIALTIES.find((s) => s.slug === "pediatria")!;
  return <SpecialtyPage specialty={specialty} />;
}