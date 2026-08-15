const METRICS = [
  {
    value: "–%",
    label: "Redução de faltas",
    note: "com lembretes automáticos",
  },
  {
    value: "–×",
    label: "Aumento de conversão",
    note: "de conversas em consultas marcadas",
  },
  {
    value: "24/7",
    label: "Disponibilidade 24h",
    note: "sua recepção nunca dorme",
  },
];

const HIGHLIGHTS = ["Respostas em segundos", "Sem fila de espera", "WhatsApp oficial"];

export default function Metricas() {
  return (
    <section id="metricas" className="py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-sidebar rounded-3xl px-6 py-16 sm:px-12 lg:px-20">
          <div className="max-w-2xl">
            <span className="inline-block rounded-full bg-white/10 text-highlight text-xs font-semibold tracking-wide uppercase px-3 py-1">
              Métricas de impacto
            </span>
            <h2 className="mt-4 text-3xl sm:text-4xl font-bold text-white tracking-tight">
              Resultados que falam por si
            </h2>
          </div>

          <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-10 sm:gap-8">
            {METRICS.map((metric) => (
              <div key={metric.label} className="sm:border-l sm:border-white/10 sm:pl-6">
                <p className="text-5xl font-bold text-primary tracking-tight">
                  {metric.value}
                </p>
                <h3 className="mt-3 text-lg font-semibold text-white">{metric.label}</h3>
                <p className="mt-1 text-sm text-slate-300">{metric.note}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-white/10 pt-8">
            {HIGHLIGHTS.map((item) => (
              <span
                key={item}
                className="inline-flex items-center gap-2 text-sm text-slate-200"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4 text-accent"
                  aria-hidden="true"
                >
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                {item}
              </span>
            ))}
          </div>

          <p className="mt-8 text-xs text-slate-400">
            Números de clientes piloto em breve.
          </p>
        </div>
      </div>
    </section>
  );
}
