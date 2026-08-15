import Link from "next/link";
import { ctaUrl } from "@/lib/landing-data";

const BULLETS = [
  "Consultas marcadas, canceladas e remarcadas",
  "Taxa de conversão da IA em tempo real",
  "Agenda diária e disponibilidade dos médicos",
];

const KPIS = [
  { label: "Consultas hoje", value: "24" },
  { label: "Canceladas", value: "2" },
  { label: "Remarcadas", value: "3" },
  { label: "Conversão IA", value: "87%" },
];

const CHART = [40, 65, 50, 80, 58, 92, 70];

export default function DashboardSection() {
  return (
    <section id="dashboard" className="py-20 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <span className="inline-block rounded-full bg-primary/15 text-primary-dark text-xs font-semibold tracking-wide uppercase px-3 py-1">
              Dashboard / Gestão
            </span>
            <h2 className="mt-4 text-3xl sm:text-4xl font-bold text-sidebar tracking-tight">
              Não é só um bot. É gestão completa da agenda.
            </h2>
            <p className="mt-4 text-slate-600 text-lg">
              Acompanhe consultas marcadas, canceladas e remarcadas, a taxa de
              conversão da IA e o dia a dia da sua clínica em um painel simples.
            </p>

            <ul className="mt-8 space-y-3">
              {BULLETS.map((bullet) => (
                <li key={bullet} className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/25 text-primary-dark">
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
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </span>
                  <span className="text-slate-700 font-medium">{bullet}</span>
                </li>
              ))}
            </ul>

            <div className="mt-10">
              <Link
                href={ctaUrl("dashboard")}
                className="inline-flex items-center justify-center rounded-xl bg-primary px-6 py-3.5 text-sm font-semibold text-sidebar shadow-sm hover:bg-primary-dark hover:text-white transition"
              >
                Começar agora
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="ml-2 h-4 w-4"
                  aria-hidden="true"
                >
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </Link>
            </div>
          </div>

          <div className="relative">
            <div className="rounded-2xl bg-white border border-slate-200 shadow-lg overflow-hidden">
              <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
                <span className="h-3 w-3 rounded-full bg-slate-200" />
                <span className="h-3 w-3 rounded-full bg-slate-200" />
                <span className="h-3 w-3 rounded-full bg-slate-200" />
                <span className="ml-3 text-xs font-medium text-slate-400">
                  Painel — Clínica Vida
                </span>
              </div>

              <div className="p-5 sm:p-6">
                <div className="grid grid-cols-2 gap-3">
                  {KPIS.map((kpi) => (
                    <div
                      key={kpi.label}
                      className="rounded-xl border border-slate-100 bg-slate-50 p-4"
                    >
                      <p className="text-2xl font-bold text-sidebar">{kpi.value}</p>
                      <p className="mt-1 text-xs text-slate-500">{kpi.label}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-6 rounded-xl border border-slate-100 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-sidebar">
                      Consultas na semana
                    </p>
                    <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-semibold text-primary-dark">
                      +12%
                    </span>
                  </div>
                  <div className="mt-4 flex items-end gap-2 h-24">
                    {CHART.map((height, i) => (
                      <div
                        key={i}
                        className={`flex-1 rounded-t-md ${i % 2 === 0 ? "bg-primary" : "bg-accent"}`}
                        style={{ height: `${height}%` }}
                      />
                    ))}
                  </div>
                  <div className="mt-2 flex justify-between gap-2">
                    {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((day) => (
                      <span key={day} className="flex-1 text-center text-[10px] text-slate-400">
                        {day}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute -bottom-4 -left-3 sm:-left-6 flex items-center gap-2 rounded-xl bg-white border border-slate-200 shadow-md px-3 py-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-highlight text-white">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                  aria-hidden="true"
                >
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </span>
              <span className="text-xs font-medium text-sidebar">
                Novo agendamento via IA ✅
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
