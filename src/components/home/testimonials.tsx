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
          <span className="inline-flex items-center rounded-full border border-white/10 bg-white/10 px-4 py-1 text-xs font-semibold text-indigo-300 backdrop-blur-md">
            Depoimentos
          </span>
          <h2 className="mt-3 text-3xl font-bold leading-tight tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent sm:text-4xl lg:text-5xl">
            Não está sozinho. Ouça a nossa comunidade
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-slate-400 sm:text-base">
            Clínicas do Brasil e de Moçambique que já receberam a recepção do SaúdeSync.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:mt-14 lg:grid-cols-3">
          {TESTIMONIALS.map((testimonial) => (
            <figure
              key={testimonial.name}
              className="flex flex-col justify-between gap-5 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md transition duration-300 hover:-translate-y-1 hover:border-white/20 hover:shadow-2xl hover:shadow-indigo-500/10"
            >
              <blockquote className="text-sm leading-relaxed text-slate-300">
                {testimonial.quote}
              </blockquote>

              <figcaption className="flex items-center gap-3 border-t border-white/10 pt-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#4f6df5] to-[#8b5cf6] text-xs font-bold text-white">
                  {testimonial.initials}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">
                    {testimonial.name}
                  </p>
                  <p className="truncate text-xs text-slate-400">
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
