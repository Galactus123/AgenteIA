import {
  BellRing,
  ChartColumn,
  Layers,
  MessageCircle,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";

type Service = {
  number: string;
  icon: LucideIcon;
  title: string;
  subtitle: string;
  description: string;
  // Só layout: largura no Bento Grid (visual, não altera textos).
  span?: boolean;
};

const SERVICES: Service[] = [
  {
    number: "001",
    icon: Users,
    title: "Gestão de Pacientes",
    subtitle: "Ficha única e histórico sempre à mão",
    description:
      "Cadastre pacientes, acompanhe consultas e tenha o histórico completo em um só lugar, com acesso seguro para toda a equipa.",
  },
  {
    number: "002",
    icon: MessageCircle,
    title: "Agendamento via WhatsApp",
    subtitle: "IA que marca consultas 24 horas por dia",
    description:
      "A IA entende o paciente, sugere a especialidade certa e marca, confirma e remarca a consulta sozinha, direto no WhatsApp.",
    span: true,
  },
  {
    number: "003",
    icon: ChartColumn,
    title: "Relatórios Clínicos",
    subtitle: "Indicadores da clínica em tempo real",
    description:
      "Veja ocupação da agenda, no-shows e faturamento em painéis simples, sem planilhas e sem trabalho manual.",
    span: true,
  },
  {
    number: "004",
    icon: BellRing,
    title: "Confirmações e Lembretes",
    subtitle: "Menos faltas, mais pontualidade",
    description:
      "Lembretes automáticos antes de cada consulta reduzem faltas e mantêm a agenda previsível sem ligação manual.",
  },
  {
    number: "005",
    icon: Layers,
    title: "Multi-especialidade",
    subtitle: "Uma agenda para cada especialidade",
    description:
      "Organize médicos, salas e especialidades no mesmo painel, com regras de horário para cada profissional.",
  },
  {
    number: "006",
    icon: ShieldCheck,
    title: "Segurança e LGPD",
    subtitle: "Dados protegidos por padrão",
    description:
      "Criptografia, controlo de acesso por utilizador e conformidade com a LGPD no Brasil e com a legislação de Moçambique.",
    span: true,
  },
];

export default function Services() {
  return (
    <section id="servicos" className="px-4 py-16 sm:px-6 lg:px-10 lg:py-24">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <h2 className="text-3xl font-bold leading-tight tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent sm:text-4xl lg:text-5xl">
            Serviços de saúde em que pode confiar
          </h2>
          <p className="text-sm leading-relaxed text-slate-400 sm:text-base lg:pb-2">
            Soluções completas para cuidar da sua clínica em cada fase: da recepção virtual ao
            relatório de gestão, tudo conectado no mesmo lugar.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:mt-14 lg:grid-cols-3">
          {SERVICES.map((service) => {
            const Icon = service.icon;
            return (
              <article
                key={service.number}
                className={`group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md transition duration-300 hover:-translate-y-1 hover:border-indigo-400/40 hover:bg-white/[0.07] hover:shadow-2xl hover:shadow-indigo-500/10 ${
                  service.span ? "lg:col-span-2" : ""
                }`}
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-indigo-500/0 blur-3xl transition duration-500 group-hover:bg-indigo-500/20"
                />

                <div className="relative flex items-start justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-indigo-200 transition duration-300 group-hover:border-transparent group-hover:bg-gradient-to-br group-hover:from-[#6366f1] group-hover:to-[#8b5cf6] group-hover:text-white">
                    <Icon size={20} />
                  </span>
                  <span className="font-mono text-lg font-semibold text-white/20">
                    {service.number}
                  </span>
                </div>

                <h3 className="relative mt-6 text-lg font-semibold tracking-tight text-white">
                  {service.title}
                </h3>
                <p className="relative mt-1 text-sm text-slate-400">
                  {service.subtitle}
                </p>

                <p className="relative mt-5 border-t border-white/10 pt-5 text-sm leading-relaxed text-slate-400">
                  {service.description}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
