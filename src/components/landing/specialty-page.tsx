import Link from "next/link";
import type { Specialty } from "@/lib/landing-data";
import { SPECIALTIES, ctaUrl } from "@/lib/landing-data";
import Header from "@/components/landing/header";
import CtaFooter from "@/components/landing/cta-footer";

const BENEFITS = [
  "Atendimento pelo WhatsApp 24h por dia",
  "Entende os sintomas e sugere a especialidade certa",
  "Agenda, confirma e lembra automaticamente",
  "Remarcação e cancelamento pelo próprio paciente",
];

export default function SpecialtyPage({ specialty }: { specialty: Specialty }) {
  const others = SPECIALTIES.filter((s) => s.slug !== specialty.slug);

  return (
    <div className="bg-background">
      <Header />
      <main>
        <section className="relative overflow-hidden bg-gradient-to-b from-teal-50 via-background to-background py-20 lg:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <nav aria-label="breadcrumb" className="text-sm text-slate-500">
              <Link href="/#especialidades" className="hover:text-primary-dark">
                Especialidades
              </Link>
              <span className="mx-2" aria-hidden="true">
                /
              </span>
              <span className="text-sidebar">{specialty.name}</span>
            </nav>
            <div className="mt-10 max-w-3xl">
              <span className="inline-flex items-center rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary-dark">
                SaúdeSync para {specialty.name}
              </span>
              <h1 className="mt-6 text-4xl font-bold tracking-tight text-sidebar sm:text-5xl">
                Agendamento de {specialty.name.toLowerCase()} pelo WhatsApp com IA
              </h1>
              <p className="mt-6 text-lg text-slate-600">{specialty.description}</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href={ctaUrl(`agendamento-${specialty.slug}`)}
                  className="inline-flex items-center justify-center rounded-full bg-primary px-7 py-3.5 text-base font-semibold text-white shadow-sm transition hover:bg-primary-dark"
                >
Começar agora
                </Link>
                <Link
                  href="/#como-funciona"
                  className="inline-flex items-center justify-center rounded-full border border-slate-300 px-7 py-3.5 text-base font-semibold text-sidebar transition hover:border-primary hover:text-primary-dark"
                >
                  Ver como funciona
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-sidebar sm:text-4xl">
                O que o SaúdeSync faz pela sua clínica
              </h2>
            </div>
            <ul className="mx-auto mt-12 grid max-w-4xl gap-4 sm:grid-cols-2">
              {BENEFITS.map((benefit) => (
                <li
                  key={benefit}
                  className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-6"
                >
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary-dark">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-3.5 w-3.5"
                      aria-hidden="true"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                  <span className="font-medium text-slate-700">{benefit}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="bg-sidebar py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
<h2 className="text-3xl font-bold text-white sm:text-4xl">
                 Pronto para atender mais pacientes em {specialty.name}?
               </h2>
               <Link
                href={ctaUrl(`agendamento-${specialty.slug}`)}
                className="mt-8 inline-flex items-center justify-center rounded-full bg-primary px-8 py-3.5 font-semibold text-white shadow-sm transition hover:bg-primary-dark"
              >
                Começar agora
              </Link>
            </div>
          </div>
        </section>

        <section className="bg-slate-50 py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-center text-xl font-semibold text-sidebar">
              Conheça outras especialidades
            </h2>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              {others.map((other) => (
                <Link
                  key={other.slug}
                  href={other.url}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-primary hover:text-primary-dark"
                >
                  {other.name}
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
      <CtaFooter />
    </div>
  );
}
