import { Star } from "lucide-react";

type Testimonial = {
  initials: string;
  name: string;
  role: string;
  quote: string;
};

const TESTIMONIALS: Testimonial[] = [
  {
    initials: "CM",
    name: "Carla Mendes",
    role: "Diretora · Clínica Vida Nova, Maputo",
    quote:
      "As faltas caíram muito depois dos lembretes automáticos. A agenda enche antes de a recepção abrir.",
  },
  {
    initials: "PR",
    name: "Paulo Ribeiro",
    role: "Médico · Centro Médico São José, Beira",
    quote:
      "Recebo a consulta já confirmada e com o motivo da visita. Poupo horas todas as semanas.",
  },
  {
    initials: "AF",
    name: "Ana Lúcia Fonseca",
    role: "Recepção · Clínica Bem Estar, Recife",
    quote:
      "O WhatsApp responde sozinho até de madrugada. Os pacientes adoram marcar sem esperar ligação.",
  },
  {
    initials: "JS",
    name: "Joana Sitoe",
    role: "Gestora · Laboratório MaxLab, Nampula",
    quote:
      "Verificámos em minutos onde perdíamos consultas. Hoje a ocupação subiu sem contratar mais gente.",
  },
  {
    initials: "MT",
    name: "Marcos Tavares",
    role: "Sócio · Centro Médico São Judas, Curitiba",
    quote:
      "A migração foi simples e o suporte responde pelo WhatsApp. Em duas semanas estávamos no ar.",
  },
  {
    initials: "LN",
    name: "Lurdes Nhaca",
    role: "Enfermeira-chefe · Clínica Esperança, Maputo",
    quote:
      "A ficha do paciente fica organizada e o histórico sempre à mão. A equipa inteira gostou.",
  },
];

export default function Testimonials() {
  return (
    <section id="depoimentos" className="px-4 py-16 sm:px-6 lg:px-10 lg:py-24">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#4f6df5]">
            Depoimentos
          </p>
          <h2 className="mt-3 text-3xl font-bold leading-tight tracking-tight text-slate-900 dark:text-white sm:text-4xl lg:text-5xl">
            Não está sozinho. Ouça a nossa comunidade
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-400 sm:text-base">
            Clínicas do Brasil e de Moçambique que já receberam a recepção do SaúdeSync.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:mt-14 lg:grid-cols-3">
          {TESTIMONIALS.map((testimonial) => (
            <figure
              key={testimonial.name}
              className="flex flex-col justify-between gap-5 rounded-3xl border border-slate-200 bg-white p-6 transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-900/5 dark:border-white/10 dark:bg-[#161926]"
            >
              <blockquote className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {testimonial.quote}
              </blockquote>

              <figcaption className="flex items-center gap-3 border-t border-slate-100 pt-4 dark:border-white/10">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#4f6df5] to-[#8b5cf6] text-xs font-bold text-white">
                  {testimonial.initials}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                    {testimonial.name}
                  </p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {testimonial.role}
                  </p>
                </div>
                <span className="ml-auto flex gap-0.5 text-amber-400" aria-label="5 de 5 estrelas">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Star key={index} size={13} fill="currentColor" strokeWidth={0} />
                  ))}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
