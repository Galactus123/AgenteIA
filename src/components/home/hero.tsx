import Link from "next/link";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { ctaUrl } from "@/lib/landing-data";
import Navbar from "./navbar";
import HeroMockup from "./hero-mockup";

const CLINIC_INITIALS = ["CV", "SM", "BE", "JP"];

export default function Hero() {
  return (
    <section id="inicio" className="px-3 pb-3 pt-3 sm:px-5 sm:pb-5 sm:pt-5">
      <div className="relative mx-auto max-w-[1400px] overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-[#6366f1] via-[#4f46e5] to-[#3b82f6] text-white shadow-2xl shadow-indigo-900/25">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.55) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.55) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 top-16 h-72 w-72 rounded-full bg-white/25 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-20 bottom-0 h-64 w-64 rounded-full bg-[#3b82f6]/50 blur-3xl"
        />

        <div className="relative">
          <Navbar />

          <div className="grid gap-12 px-5 pb-14 pt-10 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-6 lg:px-14 lg:pb-20 lg:pt-14">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white shadow-xl backdrop-blur-md sm:text-sm">
                <Sparkles size={14} />
                #1 Plataforma de gestão clínica
              </span>

              <h1 className="mt-6 text-4xl font-bold leading-[1.05] tracking-tight text-white drop-shadow-sm sm:text-5xl lg:text-6xl">
                Gestão e suporte à saúde da sua clínica.
              </h1>

              <p className="mt-5 max-w-xl text-sm leading-relaxed text-white/90 sm:text-base">
                O SaúdeSync atende pelo WhatsApp 24h, agenda consultas com IA e mantém a sua
                agenda em dia — enquanto a equipa cuida de quem importa.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href={ctaUrl("hero")}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-white/90"
                >
                  Começar agora
                </Link>
                <Link
                  href="#precos"
                  className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
                >
                  Ver planos
                  <ArrowUpRight size={16} />
                </Link>
              </div>

              <div className="mt-9 flex items-center gap-4">
                <div className="flex -space-x-3">
                  {CLINIC_INITIALS.map((initials) => (
                    <span
                      key={initials}
                      className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white/60 bg-white text-[11px] font-bold text-[#4f46e5]"
                    >
                      {initials}
                    </span>
                  ))}
                </div>
                <p className="text-xs font-medium text-white/90 sm:text-sm">
                  Mais de 150+ clínicas ativas
                  <br className="hidden sm:block" /> no Brasil 🇧🇷 e Moçambique 🇲🇿
                </p>
              </div>
            </div>

            <HeroMockup />
          </div>
        </div>
      </div>
    </section>
  );
}
