import type { Metadata } from "next";
import Hero from "@/components/home/hero";
import Services from "@/components/home/services";
import Testimonials from "@/components/home/testimonials";
import Pricing from "@/components/home/pricing";
import Footer from "@/components/home/footer";

export const metadata: Metadata = {
  title: "SaúdeSync — Gestão clínica e agendamento no WhatsApp com IA",
  description:
    "O SaúdeSync atende pacientes pelo WhatsApp 24h, agenda consultas com IA, confirma lembretes e mostra os indicadores da sua clínica. Feito para clínicas do Brasil 🇧🇷 e Moçambique 🇲🇿.",
  keywords: [
    "gestão clínica",
    "agendamento",
    "WhatsApp",
    "IA",
    "recepção virtual",
    "clínicas",
    "agendamento de consultas",
    "SaúdeSync",
  ],
  openGraph: {
    title: "SaúdeSync — Gestão clínica e agendamento no WhatsApp com IA",
    description:
      "Atenda, agende e confirme consultas pelo WhatsApp com IA. Feito para clínicas do Brasil 🇧🇷 e Moçambique 🇲🇿.",
    type: "website",
  },
};

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main>
        <Hero />
        <Services />
        <Testimonials />
        <Pricing />
      </main>
      <Footer />
    </div>
  );
}
