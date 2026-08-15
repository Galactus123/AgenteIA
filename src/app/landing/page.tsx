import type { Metadata } from "next";
import Header from "@/components/landing/header";
import Hero from "@/components/landing/hero";
import HowItWorks from "@/components/landing/how-it-works";
import Especialidades from "@/components/landing/especialidades";
import Filosofia from "@/components/landing/filosofia";
import Metricas from "@/components/landing/metricas";
import DashboardSection from "@/components/landing/dashboard-section";
import Integracoes from "@/components/landing/integracoes";
import Seguranca from "@/components/landing/seguranca";
import Precos from "@/components/landing/precos";
import Migracao from "@/components/landing/migracao";
import Suporte from "@/components/landing/suporte";
import Faq from "@/components/landing/faq";
import CtaFooter from "@/components/landing/cta-footer";

export const metadata: Metadata = {
  title: "SaúdeSync — Recepção virtual com IA que agenda consultas pelo WhatsApp",
  description:
    "O SaúdeSync entende o paciente, sugere a especialidade certa e marca a consulta sozinho pelo WhatsApp — 24h por dia. Feito para clínicas do Brasil 🇧🇷 e Moçambique 🇲🇿. Começar agora.",
  keywords: [
    "agendamento",
    "WhatsApp",
    "IA",
    "recepção virtual",
    "clínicas",
    "agendamento de consultas",
    "SaúdeSync",
  ],
  openGraph: {
    title: "SaúdeSync — Sua recepção nunca mais vai dormir",
    description:
      "Agende consultas automaticamente pelo WhatsApp com IA. Feito para clínicas do Brasil 🇧🇷 e Moçambique 🇲🇿.",
    type: "website",
  },
};

export default function LandingPage() {
  return (
    <div className="bg-background">
      <Header />
      <main>
        <Hero />
        <HowItWorks />
        <Especialidades />
        <Filosofia />
        <Metricas />
        <DashboardSection />
        <Integracoes />
        <Seguranca />
        <Precos />
        <Migracao />
        <Suporte />
        <Faq />
      </main>
      <CtaFooter />
    </div>
  );
}
