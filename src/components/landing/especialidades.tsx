import Link from "next/link";
import { SPECIALTIES } from "@/lib/landing-data";

const ICONS = [
  "M12 2v20M2 12h20M4.93 4.93l14.14 14.14M19.07 4.93L4.93 19.07",
  "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM8 15a4 4 0 0 1 8 0",
  "M12 2v4M12 18v4M2 12h4M18 12h4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M19.1 4.9l-2.8 2.8M7.7 16.3l-2.8 2.8",
  "M12 2l9 5v5c0 5-3.8 8.7-9 10-5.2-1.3-9-5-9-10V7l9-5zM9 12l2 2 4-4",
  "M12 3a7 7 0 0 1 7 7v9a1 1 0 0 1-1 1h-4v-4h3v-6a5 5 0 0 0-10 0v6h3v4H6a1 1 0 0 1-1-1v-9a7 7 0 0 1 7-7z",
  "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 6v6l4 2",
  "M12 2C7 2 3 6 3 11c0 4.5 3.4 8.3 7.8 8.9V22h2.4v-2.1c4.4-.6 7.8-4.4 7.8-8.9 0-5-4-9-9-9zM9 14l3-3 3 3-3-3-3 3",
  "M4 22V8m0 14H2M4 8l6-6 4 4 8-4-4 4v4",
  "M2 21h20M5 21v-8M10 21v-11M15 21v-9M20 21V9",
];

export default function Especialidades() {
  return (
    <section id="especialidades" className="py-20 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <span className="inline-block rounded-full bg-primary/15 text-primary-dark text-xs font-semibold tracking-wide uppercase px-3 py-1">
            Especialidades
          </span>
          <h2 className="mt-4 text-3xl sm:text-4xl font-bold text-sidebar tracking-tight">
            Atendemos todas as especialidades da sua clínica
          </h2>
          <p className="mt-4 text-slate-600 text-lg">
            Da recepção virtual ao agendamento, a IA do SaúdeSync fala a língua de cada
            especialidade e do seu paciente.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {SPECIALTIES.map((specialty, i) => (
            <Link
              key={specialty.slug}
              href={specialty.url}
              className="group bg-white rounded-2xl border border-slate-200 p-5 hover:border-primary/60 hover:shadow-md hover:-translate-y-0.5 transition"
            >
              <div className="flex items-start justify-between">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-accent/20 text-primary-dark">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-5 w-5"
                    aria-hidden="true"
                  >
                    <path d={ICONS[i % ICONS.length]} />
                  </svg>
                </span>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4 text-slate-300 group-hover:text-primary transition-colors group-hover:translate-x-0.5"
                  aria-hidden="true"
                >
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </div>
              <h3 className="mt-4 font-medium text-sidebar text-sm sm:text-base leading-tight">
                {specialty.name}
              </h3>
              <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                {specialty.description}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
