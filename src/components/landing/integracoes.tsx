const INTEGRACOES = [
  {
    name: "Google Calendar",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-9 w-9" aria-hidden="true">
        <rect x="3" y="4" width="18" height="17" rx="3" stroke="currentColor" strokeWidth="1.8" />
        <path d="M3 9h18" stroke="currentColor" strokeWidth="1.8" />
        <path d="M7.5 2.5v3M16.5 2.5v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <rect x="7.5" y="12.5" width="3.5" height="3.5" rx="0.8" fill="currentColor" />
        <rect x="13" y="12.5" width="3.5" height="3.5" rx="0.8" fill="currentColor" />
      </svg>
    ),
  },
  {
    name: "Outlook Calendar",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-9 w-9" aria-hidden="true">
        <rect x="3" y="4" width="18" height="17" rx="3" stroke="currentColor" strokeWidth="1.8" />
        <path d="M3 9h18" stroke="currentColor" strokeWidth="1.8" />
        <path d="M7.5 2.5v3M16.5 2.5v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path
          d="m8.5 13.5 2.5 2.5 4.5-4.5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    name: "KOMUNIKA",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-9 w-9" aria-hidden="true">
        <path
          d="M12 4a8 8 0 0 1 8 8c0 1.3-.3 2.5-.9 3.6l1 3.4-3.6-1.1a7.9 7.9 0 0 1-4.5.1"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path
          d="M8.5 12.5h.01M12 12.5h.01M15.5 12.5h.01"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    name: "WhatsApp",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-9 w-9" aria-hidden="true">
        <rect x="5" y="2.5" width="14" height="19" rx="3.5" stroke="currentColor" strokeWidth="1.8" />
        <path d="M12 18.5h.01" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    ),
  },
];

const PAGAMENTOS_BR = [
  {
    name: "Mercado Pago",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
        <path d="M5 8.5 6.3 5h11.4L19 8.5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <rect x="4.5" y="8.5" width="15" height="11" rx="2" stroke="currentColor" strokeWidth="1.8" />
        <path d="M12 8.5V12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    name: "Cartão de crédito",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
        <rect x="2.5" y="5" width="19" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
        <path d="M2.5 9.5h19" stroke="currentColor" strokeWidth="1.8" />
        <path d="M6 15h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
];

const PAGAMENTOS_MZ = [
  {
    name: "M-pesa",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
        <rect x="6" y="2.5" width="12" height="19" rx="3" stroke="currentColor" strokeWidth="1.8" />
        <path d="M10.5 18.5h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="12" cy="8.5" r="1.8" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    ),
  },
  {
    name: "E-mola (via LOJOU)",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
        <rect x="2.5" y="6" width="19" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
        <path d="M2.5 9.5h5a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2h-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M17 11.5h1.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
];

function PaymentBadge({ name, icon }: { name: string; icon: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-foreground">
      <span className="text-primary-dark">{icon}</span>
      {name}
    </span>
  );
}

export default function Integracoes() {
  return (
    <section id="integracoes" className="bg-white py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary-dark">
            Integrações
          </p>
          <h2 className="mt-3 text-3xl font-bold text-foreground sm:text-4xl">
            Conecta com tudo o que você já usa
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {INTEGRACOES.map((item) => (
            <div
              key={item.name}
              className="flex flex-col items-center gap-4 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm"
            >
              <span className="text-slate-400">{item.icon}</span>
              <span className="font-medium text-foreground">{item.name}</span>
            </div>
          ))}
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <h3 className="text-lg font-semibold text-foreground">🇧🇷 Brasil</h3>
            <p className="mt-1 text-sm text-slate-500">Formas de pagamento aceitas:</p>
            <div className="mt-5 flex flex-wrap gap-3">
              {PAGAMENTOS_BR.map((metodo) => (
                <PaymentBadge key={metodo.name} name={metodo.name} icon={metodo.icon} />
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <h3 className="text-lg font-semibold text-foreground">🇲🇿 Moçambique</h3>
            <p className="mt-1 text-sm text-slate-500">Formas de pagamento aceitas:</p>
            <div className="mt-5 flex flex-wrap gap-3">
              {PAGAMENTOS_MZ.map((metodo) => (
                <PaymentBadge key={metodo.name} name={metodo.name} icon={metodo.icon} />
              ))}
            </div>
          </div>
        </div>

        <p className="mt-8 text-center text-sm text-slate-500">
          Pagamentos processados de forma segura.
        </p>
      </div>
    </section>
  );
}
