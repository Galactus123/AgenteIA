import Link from "next/link";
import { ctaUrl } from "@/lib/landing-data";

const COLUMNS = [
  {
    title: "Sobre nós",
    links: [
      { label: "Quem somos", href: "/sobre-nos" },
      { label: "Preços", href: "#precos" },
      { label: "Entrar", href: "/login" },
    ],
  },
  {
    title: "Recursos",
    links: [
      { label: "Como funciona", href: "#servicos" },
      { label: "Depoimentos", href: "#depoimentos" },
      { label: "Preços completos", href: "/precos" },
    ],
  },
  {
    title: "Serviços",
    links: [
      { label: "Gestão de pacientes", href: "#servicos" },
      { label: "Agendamento via WhatsApp", href: "#servicos" },
      { label: "Relatórios clínicos", href: "#servicos" },
    ],
  },
  {
    title: "Contacto",
    links: [
      { label: "WhatsApp: +258 84 000 0000", href: ctaUrl("footer-whatsapp") },
      { label: "geral@saudesync.com", href: "mailto:geral@saudesync.com" },
      { label: "Maputo · São Paulo", href: "/sobre-nos" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="px-4 pb-6 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1400px] overflow-hidden rounded-[28px] bg-[#0D1017] px-6 py-12 text-slate-300 sm:rounded-[36px] sm:px-10 lg:px-14 lg:py-16">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_2fr]">
          <div>
            <Link href="#inicio" className="flex items-center gap-2.5" aria-label="SaúdeSync - topo da página">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#4f6df5] to-[#8b5cf6] text-white">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
                </svg>
              </span>
              <span className="text-lg font-bold tracking-tight text-white">SaúdeSync</span>
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-400">
              Recepção virtual com IA que atende, agenda e confirma consultas pelo WhatsApp — 24h
              por dia, para clínicas do Brasil e de Moçambique.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {COLUMNS.map((column) => (
              <div key={column.title}>
                <h3 className="text-sm font-semibold text-white">{column.title}</h3>
                <ul className="mt-4 space-y-2.5">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-sm text-slate-400 transition hover:text-white"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">
            © {new Date().getFullYear()} SaúdeSync. Todos os direitos reservados.
          </p>
          <div className="flex flex-wrap gap-5 text-xs text-slate-500">
            <Link href="/privacidade" className="transition hover:text-white">
              Política de Privacidade
            </Link>
            <Link href="/termos" className="transition hover:text-white">
              Termos de Serviço
            </Link>
            <Link href="/precos" className="transition hover:text-white">
              Preços
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
