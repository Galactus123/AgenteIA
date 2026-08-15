import type { Metadata } from "next";
import { SPECIALTIES } from "@/lib/landing-data";
import SpecialtyPage from "@/components/landing/specialty-page";

export const metadata: Metadata = {
  title: "Agendamento de odontologia pelo WhatsApp com IA | SaúdeSync",
  description:
    "Agendamento de odontologia. A IA entende o paciente e marca a consulta odontológica sozinha pelo WhatsApp. Começar agora no SaúdeSync.",
};

export default function Page() {
  const specialty = SPECIALTIES.find((s) => s.slug === "odontologia")!;
  return <SpecialtyPage specialty={specialty} />;
}