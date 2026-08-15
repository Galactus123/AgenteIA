import Link from "next/link";
import { ctaUrl } from "@/lib/landing-data";

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="text-primary-dark"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export default function Hero() {
  return (
    <section
      id="inicio"
      className="relative scroll-mt-16 overflow-hidden bg-gradient-to-b from-teal-50 via-background to-background py-20 lg:py-28"
    >
      <div className="mx-auto grid max-w-7xl items-center gap-16 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary-dark">
            Feito para clínicas do Brasil 🇧🇷 e Moçambique 🇲🇿
          </span>
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-sidebar sm:text-5xl">
            Sua recepção nunca mais vai dormir. Agende consultas automaticamente
            pelo WhatsApp com IA.
          </h1>
          <p className="mt-6 text-lg text-slate-600">
            O SaúdeSync entende o paciente, sugere a especialidade certa e marca
            a consulta sozinho — 24h por dia, sem perder mensagem.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href={ctaUrl("hero")}
              className="inline-flex items-center justify-center rounded-full bg-primary px-7 py-3.5 text-base font-semibold text-white shadow-sm transition hover:bg-primary-dark"
            >
              Começar agora
            </Link>
            <Link
              href="#como-funciona"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 px-7 py-3.5 text-base font-semibold text-sidebar transition hover:border-primary hover:text-primary-dark"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <polygon points="6 3 20 12 6 21 6 3" />
              </svg>
              Ver como funciona
            </Link>
          </div>
          <p className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-500">
            <span className="flex items-center gap-1.5">
              <CheckIcon />
              Sem instalação
            </span>
            <span className="flex items-center gap-1.5">
              <CheckIcon />
              Teste grátis
            </span>
            <span className="flex items-center gap-1.5">
              <CheckIcon />
              LGPD
            </span>
          </p>
        </div>

        <div className="relative mx-auto w-full max-w-sm">
          <div
            className="absolute -inset-10 rounded-full bg-primary/20 blur-3xl"
            aria-hidden="true"
          />
          <div className="relative rounded-[2.5rem] border border-slate-200 bg-white p-2 shadow-2xl">
            <div className="overflow-hidden rounded-[2rem] bg-slate-100">
              <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary-dark">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
                  </svg>
                </span>
                <div>
                  <p className="text-sm font-semibold text-sidebar">
                    Clínica Vida+
                  </p>
                  <p className="flex items-center gap-1.5 text-xs text-slate-500">
                    <span
                      className="h-1.5 w-1.5 rounded-full bg-highlight"
                      aria-hidden="true"
                    />
                    online
                  </p>
                </div>
              </div>
              <div className="space-y-3 px-4 py-5">
                <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-white px-3.5 py-2.5 shadow-sm">
                  <p className="text-sm text-sidebar">
                    Estou com dor de cabeça há três dias.
                  </p>
                  <p className="mt-1 text-right text-[10px] text-slate-400">
                    14:32
                  </p>
                </div>
                <div className="ml-auto max-w-[80%] rounded-2xl rounded-tr-sm bg-primary px-3.5 py-2.5 shadow-sm">
                  <p className="text-sm text-white">
                    Entendi! Vou buscar horários com o Clínico Geral.
                  </p>
                  <p className="mt-1 text-right text-[10px] text-white/60">
                    14:32
                  </p>
                </div>
                <div className="ml-auto flex w-fit max-w-[70%] items-center gap-1 rounded-2xl rounded-tr-sm bg-primary px-4 py-3 shadow-sm">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/70" />
                  <span
                    className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/70"
                    style={{ animationDelay: "150ms" }}
                  />
                  <span
                    className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/70"
                    style={{ animationDelay: "300ms" }}
                  />
                </div>
                <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-white px-3.5 py-2.5 shadow-sm">
                  <p className="text-sm text-sidebar">
                    Pronto! Consulta marcada com o Clínico Geral para quarta às
                    09h30.
                  </p>
                  <p className="mt-1 text-right text-[10px] text-slate-400">
                    14:33
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="absolute -bottom-5 right-6 flex items-center gap-2 rounded-full bg-white px-4 py-2.5 shadow-lg ring-1 ring-slate-200">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-highlight text-primary-dark">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </span>
            <p className="text-sm font-semibold text-sidebar">
              Consulta marcada ✅
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
