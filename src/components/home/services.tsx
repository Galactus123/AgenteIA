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
  },
  {
    number: "003",
    icon: ChartColumn,
    title: "Relatórios Clínicos",
    subtitle: "Indicadores da clínica em tempo real",
    description:
      "Veja ocupação da agenda, no-shows e faturamento em painéis simples, sem planilhas e sem trabalho manual.",
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
  },
];

export default function Services() {
  return (
    <section id="servicos" className="px-4 py-16 sm:px-6 lg:px-10 lg:py-24">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <h2 className="text-3xl font-bold leading-tight tracking-tight text-slate-900 dark:text-white sm:text-4xl lg:text-5xl">
            Serviços de saúde em que pode confiar
          </h2>
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400 sm:text-base lg:pb-2">
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
                className="group rounded-3xl border border-slate-200 bg-white p-6 transition duration-300 hover:-translate-y-1 hover:border-[#4f6df5]/40 hover:shadow-xl hover:shadow-[#4f6df5]/10 dark:border-white/10 dark:bg-[#161926]"
              >
                <div className="flex items-start justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-700 transition group-hover:bg-[#4f6df5] group-hover:text-white dark:bg-white/5 dark:text-slate-300">
                    <Icon size={20} />
                  </span>
                  <span className="font-mono text-lg font-semibold text-slate-300 dark:text-white/20">
                    {service.number}
                  </span>
                </div>

                <h3 className="mt-6 text-lg font-semibold text-slate-900 dark:text-white">
                  {service.title}
                </h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  {service.subtitle}
                </p>

                <p className="mt-5 border-t border-slate-100 pt-5 text-sm leading-relaxed text-slate-500 dark:border-white/10 dark:text-slate-400">
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
