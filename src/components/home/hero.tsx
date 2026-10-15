import Link from "next/link";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { ctaUrl } from "@/lib/landing-data";
import Navbar from "./navbar";
import HeroMockup from "./hero-mockup";

const CLINIC_INITIALS = ["CV", "SM", "BE", "JP"];

export default function Hero() {
  return (
    <section id="inicio" className="px-3 pb-3 pt-3 sm:px-5 sm:pb-5 sm:pt-5">
      <div className="relative mx-auto max-w-[1400px] overflow-hidden rounded-[2.5rem] border border-white/10 bg-[#0B0D14]/80 text-white shadow-2xl shadow-black/50 backdrop-blur-xl">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.55) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.55) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 top-0 h-96 w-96 rounded-full bg-[#6366f1]/30 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-24 bottom-0 h-80 w-80 rounded-full bg-[#8b5cf6]/25 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/3 h-72 w-72 -translate-x-1/2 rounded-full bg-[#3b82f6]/15 blur-3xl"
        />

        <div className="relative">
          <Navbar />

          <div className="grid gap-12 px-5 pb-14 pt-10 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-6 lg:px-14 lg:pb-20 lg:pt-14">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-1.5 text-xs font-semibold text-slate-200 backdrop-blur-md sm:py-2 sm:text-sm">
                <Sparkles size={14} className="text-indigo-300" />
                #1 Plataforma de gestão clínica
              </span>

              <h1 className="mt-6 text-4xl font-bold leading-[1.05] tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent sm:text-5xl lg:text-6xl">
                Gestão e suporte à saúde da sua clínica.
              </h1>

              <p className="mt-5 max-w-xl text-sm leading-relaxed text-slate-300 sm:text-base">
                O SaúdeSync atende pelo WhatsApp 24h, agenda consultas com IA e mantém a sua
                agenda em dia — enquanto a equipa cuida de quem importa.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href={ctaUrl("hero")}
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition duration-300 hover:brightness-110 hover:shadow-indigo-500/40"
                >
                  Começar agora
                </Link>
                <Link
                  href="#precos"
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-slate-200 backdrop-blur-md transition hover:bg-white/10"
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
                      className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#0B0D14] bg-white/10 text-[11px] font-bold text-indigo-200 backdrop-blur-md"
                    >
                      {initials}
                    </span>
                  ))}
                </div>
                <p className="text-xs font-medium text-slate-300 sm:text-sm">
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
