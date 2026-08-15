"use client";

import { useState } from "react";
import Link from "next/link";
import { ADDONS, PLANS, ctaUrl } from "@/lib/landing-data";

export default function Precos() {
  const [country, setCountry] = useState<"br" | "mz">("br");
  const plan = PLANS.find((p) => p.id === country) ?? PLANS[0];

  return (
    <section id="precos" className="bg-white py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-8 max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary-dark">
            Planos e preços
          </p>
          <h2 className="mt-3 text-3xl font-bold text-foreground sm:text-4xl">
            Transparente, sem surpresa
          </h2>
        </div>

        <div className="flex justify-center">
          <div className="flex items-center gap-1 rounded-full bg-slate-100 p-1">
            {PLANS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setCountry(p.id)}
                aria-pressed={country === p.id}
                className={`rounded-full px-5 py-2.5 text-sm font-semibold transition-colors ${
                  country === p.id
                    ? "bg-primary text-white"
                    : "text-slate-600 hover:text-foreground"
                }`}
              >
                {p.flag} {p.id === "br" ? "Real" : "Metical"}
              </button>
            ))}
          </div>
        </div>

        <div className="mx-auto mt-10 max-w-md">
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-foreground">SaúdeSync Base</h3>
              <span className="rounded-full bg-accent/20 px-3 py-1 text-xs font-semibold text-primary-dark">
                {plan.flag} {plan.country}
              </span>
            </div>
            <p className="mt-6 text-4xl font-bold text-foreground">
              <span className="text-primary-dark">{plan.currency}</span> {plan.price}
              <span className="text-lg font-medium text-slate-500">/{plan.cadence}</span>
            </p>
            <ul className="mt-6 space-y-3">
              {plan.includes.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-slate-600">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className="mt-0.5 h-5 w-5 shrink-0 text-primary"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
                    <path
                      d="m8.5 12.5 2.3 2.3 4.7-4.7"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
            <Link
              href={ctaUrl("precos")}
              className="mt-8 flex w-full items-center justify-center rounded-full bg-primary px-6 py-3 font-semibold text-white transition-colors hover:bg-primary-dark"
            >
              Começar agora
            </Link>
          </div>
        </div>

        <div className="mx-auto mt-16 max-w-3xl">
          <h3 className="text-center text-xl font-semibold text-foreground">
            Módulos adicionais
          </h3>
          <ul className="mt-6 space-y-3">
            {ADDONS.map((addon) => (
              <li
                key={addon.name}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium text-foreground">{addon.name}</span>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold text-primary-dark ${
                      addon.status === "Em breve" ? "bg-highlight/20" : "bg-accent/20"
                    }`}
                  >
                    {addon.status}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-500">{addon.description}</p>
              </li>
            ))}
          </ul>
          <p className="mt-8 text-center text-sm text-slate-500">
            Sem taxa de setup. Cancele quando quiser.
          </p>
        </div>
      </div>
    </section>
  );
}
