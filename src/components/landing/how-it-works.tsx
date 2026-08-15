import Link from "next/link";
import { ctaUrl } from "@/lib/landing-data";

const STEPS = [
  {
    number: "01",
    title: "Entendimento Inteligente",
    description: "A IA entende o que o paciente sente e sugere a especialidade certa.",
    bullets: ["Lê linguagem natural", "Sugere a especialidade certa", "Pergunta quando precisa"],
    icon: "chat",
  },
  {
    number: "02",
    title: "Agendamento Automático",
    description: "Busca horários, o paciente escolhe, a consulta é marcada sozinha.",
    bullets: ["Disponibilidade em tempo real", "Paciente escolhe o horário", "Reserva imediata"],
    icon: "calendar",
  },
  {
    number: "03",
    title: "Confirmação e Lembretes",
    description: "Lembretes automáticos 24h e 2h antes reduzem faltas.",
    bullets: ["Confirmação na hora", "Lembrete 24h antes", "Lembrete 2h antes"],
    icon: "bell",
  },
  {
    number: "04",
    title: "Remarcação e Cancelamento",
    description: "O paciente resolve tudo sozinho pelo WhatsApp.",
    bullets: ["Remarca sem ligar", "Cancela sem burocracia", "Horário liberado na agenda"],
    icon: "refresh",
  },
] as const;

type StepIconName = (typeof STEPS)[number]["icon"];

function StepIcon({ icon }: { icon: StepIconName }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (icon) {
    case "calendar":
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" x2="16" y1="2" y2="6" />
          <line x1="8" x2="8" y1="2" y2="6" />
          <line x1="3" x2="21" y1="10" y2="10" />
        </svg>
      );
    case "bell":
      return (
        <svg {...common}>
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      );
    case "refresh":
      return (
        <svg {...common}>
          <polyline points="23 4 23 10 17 10" />
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
        </svg>
      );
  }
}

export default function HowItWorks() {
  return (
    <section id="como-funciona" className="scroll-mt-16 bg-white py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary-dark">
            Como funciona
          </span>
          <h2 className="mt-5 text-3xl font-bold tracking-tight text-sidebar sm:text-4xl">
            Do sintoma à consulta marcada, sem tocar no telefone
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            Quatro passos simples entre o primeiro “oi” e a consulta confirmada.
          </p>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <div
              key={step.number}
              className="relative rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              {index < STEPS.length - 1 && (
                <span
                  className="absolute -right-4 top-1/2 z-10 hidden -translate-y-1/2 lg:flex"
                  aria-hidden="true"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-primary-dark shadow-sm">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </span>
                </span>
              )}
              <span className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary-dark">
                {step.number}
              </span>
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-primary-dark">
                <StepIcon icon={step.icon} />
              </span>
              <h3 className="mt-5 text-lg font-semibold text-sidebar">
                {step.title}
              </h3>
              <p className="mt-2 text-sm text-slate-600">{step.description}</p>
              <ul className="mt-4 space-y-2">
                {step.bullets.map((bullet) => (
                  <li key={bullet} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary-dark">
                      <svg
                        width="10"
                        height="10"
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
                    {bullet}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Link
            href={ctaUrl("como-funciona")}
            className="inline-flex items-center justify-center rounded-full bg-primary px-7 py-3.5 text-base font-semibold text-white shadow-sm transition hover:bg-primary-dark"
          >
            Começar agora
          </Link>
        </div>
      </div>
    </section>
  );
}
