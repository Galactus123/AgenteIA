const PILLARS = [
  {
    title: "Entende contexto, não só palavras-chave",
    description:
      "A IA acompanha a conversa e o que o paciente realmente quer dizer, como um humano faria.",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-6 w-6"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M9 12l2 2 4-5" />
        <path d="M7 8.5A4 4 0 0 1 9.5 6M17 15.5A4 4 0 0 1 14.5 18" />
      </svg>
    ),
  },
  {
    title: "Agenda de ponta a ponta, sem intervenção humana",
    description:
      "Do primeiro atendimento à confirmação, tudo acontece sozinho no WhatsApp.",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-6 w-6"
        aria-hidden="true"
      >
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M3 10h18M8 2v4M16 2v4" />
        <path d="M12 16v2M9 17h6" />
      </svg>
    ),
  },
  {
    title: "Funciona nos dois mercados",
    description:
      "WhatsApp + pagamentos locais no Brasil 🇧🇷 e em Moçambique 🇲🇿.",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-6 w-6"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
      </svg>
    ),
  },
];

export default function Filosofia() {
  return (
    <section id="diferencial" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-sidebar tracking-tight leading-tight">
            Você não precisa de mais um chatbot.
            <span className="block text-primary-dark">Precisa de uma recepcionista que nunca dorme.</span>
          </h2>
        </div>

        <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-6">
          {PILLARS.map((pillar) => (
            <div
              key={pillar.title}
              className="rounded-2xl border border-slate-200 p-6"
            >
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-white shadow-sm">
                {pillar.icon}
              </span>
              <h3 className="mt-5 text-lg font-semibold text-sidebar leading-snug">
                {pillar.title}
              </h3>
              <p className="mt-2 text-slate-600 leading-relaxed">
                {pillar.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
