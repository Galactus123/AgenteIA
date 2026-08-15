import type { Metadata } from "next";
import { SPECIALTIES } from "@/lib/landing-data";
import SpecialtyPage from "@/components/landing/specialty-page";

export const metadata: Metadata = {
  title: "Agendamento de centros médicos pelo WhatsApp com IA | SaúdeSync",
  description:
    "Agendamento de centros médicos. A IA entende o paciente e marca consultas de várias especialidades sozinha pelo WhatsApp. Começar agora no SaúdeSync.",
};

export default function Page() {
  const specialty = SPECIALTIES.find((s) => s.slug === "centros-medicos")!;
  return <SpecialtyPage specialty={specialty} />;
}