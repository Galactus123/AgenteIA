"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, MessageCircle, X } from "lucide-react";
import { ctaUrl } from "@/lib/landing-data";

// Contacto oficial (WhatsApp Business do SaúdeSync).
const WHATSAPP_URL = "https://wa.me/258860020811";

const NAV_LINKS = [
  { label: "Início", href: "#inicio" },
  { label: "Funcionalidades", href: "#servicos" },
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
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 rounded-full border border-white/10 bg-white/5 px-3 py-2.5 shadow-lg shadow-black/30 backdrop-blur-md sm:px-4">
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
          <span className="text-[15px] font-bold tracking-tight text-white">SaúdeSync</span>
        </Link>

        <nav className="hidden items-center gap-7 lg:flex" aria-label="Navegação principal">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="text-sm font-medium text-slate-300 transition hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Falar no WhatsApp: +258 860020811"
            className="flex h-10 w-10 items-center justify-center rounded-full text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            <MessageCircle size={18} />
          </a>
          <Link
            href="/login"
            className="rounded-full px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
          >
            Entrar
          </Link>
          <a
            href={ctaUrl("navbar")}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition duration-300 hover:brightness-110 hover:shadow-indigo-500/40"
          >
            Começar agora
          </a>
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="menu-landing"
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          className="flex h-10 w-10 items-center justify-center rounded-full text-slate-200 transition hover:bg-white/10 lg:hidden"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {open && (
        <div
          id="menu-landing"
          className="absolute left-4 right-4 top-full mt-3 rounded-3xl border border-white/10 bg-[#0B0D14]/90 p-3 shadow-2xl shadow-black/50 backdrop-blur-xl sm:left-6 sm:right-6 lg:hidden"
        >
          <nav className="flex flex-col gap-1" aria-label="Navegação móvel">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                onClick={close}
                className="rounded-xl px-3 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/10"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="mt-2 flex flex-col gap-2 border-t border-white/10 pt-3">
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={close}
              className="rounded-full border border-white/15 px-5 py-2.5 text-center text-sm font-semibold text-slate-200 transition hover:border-indigo-400/50 hover:text-white"
            >
              WhatsApp: +258 860020811
            </a>
            <Link
              href="/login"
              onClick={close}
              className="rounded-full border border-white/15 px-5 py-2.5 text-center text-sm font-semibold text-slate-200 transition hover:border-indigo-400/50 hover:text-white"
            >
              Entrar
            </Link>
            <a
              href={ctaUrl("navbar-mobile")}
              onClick={close}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] px-5 py-2.5 text-center text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition duration-300 hover:brightness-110"
            >
              Começar agora
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
