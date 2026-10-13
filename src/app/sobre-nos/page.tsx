import type { Metadata } from "next";
import Header from "@/components/landing/header";
import CtaFooter from "@/components/landing/cta-footer";

export const metadata: Metadata = {
  title: "Sobre Nós | SaúdeSync",
  description:
    "SaúdeSync é uma plataforma desenvolvida para simplificar a gestão de clínicas e consultórios, automatizando o agendamento de consultas e o atendimento de pacientes via inteligência artificial.",
};

export default function SobreNosPage() {
  return (
    <div className="bg-background">
      <Header />
      <main>
        <section className="relative overflow-hidden rounded-b-[40px] bg-gradient-to-b from-[#0D1017] via-[#101426] to-[#161B31] pb-24 pt-24 lg:pb-28 lg:pt-32">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-24 -top-16 h-72 w-72 rounded-full bg-[#4f6df5]/25 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-[#8b5cf6]/20 blur-3xl"
          />
          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <span className="inline-flex items-center rounded-full border border-blue-500/30 bg-blue-500/20 px-4 py-1.5 text-sm font-medium text-blue-400">
              Sobre o SaúdeSync
            </span>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-white sm:text-5xl">
              Nossa história e missão
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
              Simplificamos a gestão de clínicas e consultórios com atendimento e agendamento
              inteligentes no WhatsApp, 24 horas por dia.
            </p>
          </div>
        </section>

        <section className="bg-white py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-4xl space-y-12">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                  Nossa missão
                </h2>
                <p className="mt-4 text-lg text-slate-600 leading-relaxed">
                  Automatizar o atendimento e agendamento de consultas de
                  clínicas e consultórios via IA no WhatsApp 24 horas por
                  dia, 7 dias por semana, garantindo que nenhuma mensagem de
                  paciente seja perdida.
                </p>
              </div>

              <div>
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                  Como surgiu
                </h2>
                <p className="mt-4 text-lg text-slate-600 leading-relaxed">
                  Criado para resolver a alta demanda de atendimento em
                  clínicas, reduzindo o tempo de espera dos pacientes e
                  otimizando a rotina dos profissionais de saúde.
                </p>
              </div>

              <div>
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                  Atuação
                </h2>
                <p className="mt-4 text-lg text-slate-600 leading-relaxed">
                  Focado no atendimento a clínicas e profissionais de saúde no
                  Brasil 🇧🇷 e Moçambique 🇲🇿.
                </p>
              </div>

              <div>
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                  Funcionalidades de destaque
                </h2>
                <ul className="mt-4 space-y-3">
                  <li className="flex items-start gap-3 text-lg text-slate-600">
                    <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary-dark">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-3 w-3"
                        aria-hidden="true"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                    Entendimento da necessidade do paciente
                  </li>
                  <li className="flex items-start gap-3 text-lg text-slate-600">
                    <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary-dark">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-3 w-3"
                        aria-hidden="true"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                    Sugestão automática da especialidade adequada
                  </li>
                  <li className="flex items-start gap-3 text-lg text-slate-600">
                    <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary-dark">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-3 w-3"
                        aria-hidden="true"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                    Confirmação direta da consulta sem necessidade de
                    instalação complexa
                  </li>
                </ul>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
                <h3 className="text-lg font-semibold text-slate-900">
                  Contacte-nos
                </h3>
                <p className="mt-2 text-slate-600">
                  📧{" "}
                  <a
                    href="mailto:saudesync1info@gmail.com"
                    className="text-primary-dark hover:underline"
                  >
                    saudesync1info@gmail.com
                  </a>
                </p>
                <p className="mt-1 text-slate-600">
                  📱{" "}
                  <a
                    href="https://wa.me/258853287859"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-dark hover:underline"
                  >
                    +258 853 287 859
                  </a>
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <CtaFooter />
    </div>
  );
}