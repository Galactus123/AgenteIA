"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { ctaUrl } from "@/lib/landing-data";

const NAV_LINKS = [
  { label: "Início", href: "#inicio" },
  { label: "Funcionalidades", href: "#servicos" },
  { label: "Depoimentos", href: "#depoimentos" },
  { label: "Preços", href: "#precos" },
  { label: "Sobre nós", href: "/sobre-nos" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const close = () => setOpen(false);

  return (
    <div className="relative z-20 px-4 pt-4 sm:px-6 sm:pt-6 lg:px-10">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 rounded-full border border-white/40 bg-white px-3 py-2.5 shadow-lg shadow-[#2c2f7a]/15 sm:px-4">
        <Link href="#inicio" className="flex items-center gap-2 pl-1" aria-label="SaúdeSync - página inicial">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#4f6df5] to-[#8b5cf6] text-white">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
            </svg>
          </span>
          <span className="text-[15px] font-bold tracking-tight text-slate-900">SaúdeSync</span>
        </Link>

        <nav className="hidden items-center gap-7 lg:flex" aria-label="Navegação principal">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="text-sm font-medium text-slate-600 transition hover:text-[#4f6df5]"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Link
            href="/login"
            className="rounded-full px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Entrar
          </Link>
          <Link
            href={ctaUrl("navbar")}
            className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#4f6df5]"
          >
            Começar agora
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="menu-landing"
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          className="flex h-10 w-10 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-100 lg:hidden"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {open && (
        <div
          id="menu-landing"
          className="absolute left-4 right-4 top-full mt-3 rounded-3xl border border-slate-200 bg-white p-3 shadow-2xl sm:left-6 sm:right-6 lg:hidden"
        >
          <nav className="flex flex-col gap-1" aria-label="Navegação móvel">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                onClick={close}
                className="rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="mt-2 flex flex-col gap-2 border-t border-slate-100 pt-3">
            <Link
              href="/login"
              onClick={close}
              className="rounded-full border border-slate-300 px-5 py-2.5 text-center text-sm font-semibold text-slate-700 transition hover:border-[#4f6df5] hover:text-[#4f6df5]"
            >
              Entrar
            </Link>
            <Link
              href={ctaUrl("navbar-mobile")}
              onClick={close}
              className="rounded-full bg-slate-900 px-5 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-[#4f6df5]"
            >
              Começar agora
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
