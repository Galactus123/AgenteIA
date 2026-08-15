"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { SPECIALTIES, ctaUrl } from "@/lib/landing-data";

const NAV_LINKS = [
  { label: "Como funciona", href: "#como-funciona" },
  { label: "Preços", href: "#precos" },
];

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [specOpen, setSpecOpen] = useState(false);
  const specRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!specOpen) return;
    const handleClick = (event: MouseEvent) => {
      if (specRef.current && !specRef.current.contains(event.target as Node)) {
        setSpecOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSpecOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [specOpen]);

  const closeMobile = () => setMobileOpen(false);

  return (
    <header
      id="topo"
      className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:h-20 lg:px-8">
        <Link
          href="#inicio"
          className="flex items-center gap-2.5"
          aria-label="SaúdeSync - página inicial"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white">
            <svg
              width="20"
              height="20"
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
          <span className="text-lg font-bold tracking-tight text-sidebar">
            SaúdeSync
          </span>
        </Link>

        <nav
          className="hidden items-center gap-8 lg:flex"
          aria-label="Navegação principal"
        >
          <Link
            href="#como-funciona"
            className="text-sm font-medium text-slate-700 transition hover:text-primary-dark"
          >
            Como funciona
          </Link>
          <div className="relative" ref={specRef}>
            <button
              type="button"
              onClick={() => setSpecOpen((open) => !open)}
              aria-expanded={specOpen}
              aria-haspopup="true"
              className="flex items-center gap-1 text-sm font-medium text-slate-700 transition hover:text-primary-dark"
            >
              Especialidades
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className={`transition-transform duration-200 ${specOpen ? "rotate-180" : ""}`}
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            {specOpen && (
              <div className="absolute left-0 top-full mt-3 w-72 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                {SPECIALTIES.map((specialty) => (
                  <Link
                    key={specialty.slug}
                    href={specialty.url}
                    onClick={() => setSpecOpen(false)}
                    className="block rounded-lg px-3 py-2 text-sm text-slate-700 transition hover:bg-primary/5 hover:text-primary-dark"
                  >
                    {specialty.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="text-sm font-medium text-slate-700 transition hover:text-primary-dark"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <Link
            href="/login"
            className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-semibold text-sidebar transition hover:border-primary hover:text-primary-dark"
          >
            Entrar
          </Link>
          <Link
            href={ctaUrl("header")}
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-dark"
          >
            Começar agora
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen((open) => !open)}
          aria-expanded={mobileOpen}
          aria-controls="menu-mobile"
          aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-700 transition hover:bg-slate-100 lg:hidden"
        >
          {mobileOpen ? (
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          ) : (
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M4 6h16" />
              <path d="M4 12h16" />
              <path d="M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {mobileOpen && (
        <div
          id="menu-mobile"
          className="border-t border-slate-200 bg-white px-4 pb-6 pt-4 sm:px-6 lg:hidden"
        >
          <nav className="flex flex-col gap-1" aria-label="Navegação móvel">
            <Link
              href="#como-funciona"
              onClick={closeMobile}
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-primary/5"
            >
              Como funciona
            </Link>
            <p className="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Especialidades
            </p>
            {SPECIALTIES.map((specialty) => (
              <Link
                key={specialty.slug}
                href={specialty.url}
                onClick={closeMobile}
                className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-primary/5 hover:text-primary-dark"
              >
                {specialty.name}
              </Link>
            ))}
            {NAV_LINKS.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                onClick={closeMobile}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-primary/5"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4">
            <Link
              href="/login"
              onClick={closeMobile}
              className="rounded-full border border-slate-300 px-5 py-2.5 text-center text-sm font-semibold text-sidebar transition hover:border-primary hover:text-primary-dark"
            >
              Entrar
            </Link>
            <Link
              href={ctaUrl("header")}
              onClick={closeMobile}
              className="rounded-full bg-primary px-5 py-2.5 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-primary-dark"
            >
              Começar agora
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
