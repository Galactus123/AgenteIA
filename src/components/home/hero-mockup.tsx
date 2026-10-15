import { BadgeCheck, CircleCheck, Clock, Send, Sparkles, Wifi } from "lucide-react";

const MESSAGES = [
  {
    from: "patient",
    text: "Olá! Estou com dor de cabeça forte desde ontem. Consigo marcar uma consulta?",
  },
  {
    from: "bot",
    text: "Claro. A Dra. Ana Silva tem uma vaga amanhã às 10h na Clínica Geral. Confirma?",
  },
  {
    from: "patient",
    text: "Confirma, por favor.",
  },
  {
    from: "bot",
    text: "Consulta confirmada para amanhã, 10h. Vamos enviar um lembrete no WhatsApp.",
  },
];

const GLASS_CARD =
  "bg-white/5 backdrop-blur-md border border-white/10 shadow-2xl shadow-black/40 text-white";

export default function HeroMockup() {
  return (
    <div className="relative mx-auto w-full max-w-[460px] pb-10 sm:pb-14">
      <span
        className={`absolute -left-1 top-0 z-20 flex items-center gap-2 rounded-2xl px-3.5 py-2.5 text-xs font-semibold sm:-left-6 sm:text-sm ${GLASS_CARD}`}
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-indigo-200">
          <Clock size={15} />
        </span>
        Serviço 24h
      </span>

      <span
        className={`absolute -right-1 top-24 z-20 flex items-center gap-2 rounded-2xl px-3.5 py-2.5 text-xs font-semibold sm:-right-6 sm:text-sm ${GLASS_CARD}`}
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-indigo-200">
          <Wifi size={15} />
        </span>
        WhatsApp Ativo
      </span>

      <div className="relative z-10 overflow-hidden rounded-[28px] border border-white/10 bg-white/5 text-white shadow-2xl shadow-black/40 backdrop-blur-xl">
        <div className="flex items-center gap-3 border-b border-white/10 bg-white/5 px-4 py-3.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] text-sm font-bold text-white">
            S
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">
              SaúdeSync · Recepção IA
            </p>
            <p className="flex items-center gap-1.5 text-xs text-slate-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Online agora
            </p>
          </div>
          <BadgeCheck size={18} className="text-indigo-300" />
        </div>

        <div className="space-y-3 px-4 py-4">
          {MESSAGES.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.from === "bot" ? "justify-end" : "justify-start"}`}
            >
              <p
                className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-snug text-white ${
                  message.from === "bot"
                    ? "rounded-br-md bg-gradient-to-br from-[#6366f1] to-[#4f46e5]/90 font-medium shadow-lg shadow-indigo-500/20"
                    : "rounded-bl-md border border-white/10 bg-white/5 text-slate-100"
                }`}
              >
                {message.text}
              </p>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 border-t border-white/10 bg-white/5 px-4 py-3">
          <span className="flex-1 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-[13px] text-slate-400">
            Escreva uma mensagem...
          </span>
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] text-white">
            <Send size={15} />
          </span>
        </div>
      </div>

      <span
        className={`absolute bottom-0 left-0 z-20 flex items-center gap-2 rounded-2xl px-3.5 py-2.5 text-xs font-semibold sm:left-4 sm:text-sm ${GLASS_CARD}`}
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300">
          <CircleCheck size={15} />
        </span>
        Consulta confirmada
      </span>

      <div
        className={`absolute bottom-0 right-0 z-20 flex items-center gap-3 rounded-2xl px-3 py-2.5 sm:right-2 ${GLASS_CARD}`}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] text-xs font-bold text-white">
          AR
        </span>
        <div className="leading-tight">
          <p className="text-[13px] font-semibold text-white">Chamada em curso</p>
          <p className="text-[11px] text-slate-300">Atendimento ao paciente</p>
        </div>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-white">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M6.6 10.8a15.05 15.05 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.2.4 2.4.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.4 0 .8-.2 1l-2.3 2.2Z" />
          </svg>
        </span>
      </div>

      <span className="absolute -top-8 right-6 z-20 hidden items-center gap-1.5 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white shadow-2xl backdrop-blur-md sm:flex">
        <Sparkles size={13} className="text-indigo-300" />
        Agendamento com IA
      </span>
    </div>
  );
}
