import Link from "next/link";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { ctaUrl } from "@/lib/landing-data";
import Navbar from "./navbar";
import HeroMockup from "./hero-mockup";

const CLINIC_INITIALS = ["CV", "SM", "BE", "JP"];

export default function Hero() {
  return (
    <section id="inicio" className="px-3 pt-3 sm:px-5 sm:pt-5">
      <div className="relative mx-auto max-w-[1400px] overflow-hidden rounded-[28px] bg-gradient-to-br from-[#4f6df5] via-[#6366f1] to-[#8b5cf6] text-white sm:rounded-[36px]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-20"
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
          className="pointer-events-none absolute -left-20 bottom-0 h-64 w-64 rounded-full bg-[#8b5cf6]/50 blur-3xl"
        />

        <div className="relative">
          <Navbar />

          <div className="grid gap-12 px-5 pb-14 pt-10 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-6 lg:px-14 lg:pb-20 lg:pt-14">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/15 px-4 py-2 text-xs font-semibold backdrop-blur sm:text-sm">
                <Sparkles size={14} />
                #1 Plataforma de gestão clínica
              </span>

              <h1 className="mt-6 text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
                Gestão e suporte à saúde da sua clínica.
              </h1>

              <p className="mt-5 max-w-xl text-sm leading-relaxed text-white/85 sm:text-base">
                O SaúdeSync atende pelo WhatsApp 24h, agenda consultas com IA e mantém a sua
                agenda em dia — enquanto a equipa cuida de quem importa.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="#precos"
                  className="inline-flex items-center gap-2 rounded-full border border-white/50 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Ver planos
                  <ArrowUpRight size={16} />
                </Link>
                <Link
                  href={ctaUrl("hero")}
                  className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-black"
                >
                  Começar agora
                </Link>
              </div>

              <div className="mt-9 flex items-center gap-4">
                <div className="flex -space-x-3">
                  {CLINIC_INITIALS.map((initials) => (
                    <span
                      key={initials}
                      className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#6366f1] bg-white text-[11px] font-bold text-[#4f6df5]"
                    >
                      {initials}
                    </span>
                  ))}
                </div>
                <p className="text-xs font-medium text-white/85 sm:text-sm">
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
