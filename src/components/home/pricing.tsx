"use client";

import Link from "next/link";
import { Check, Sparkles } from "lucide-react";
import { ADDONS, PLANS, ctaUrl } from "@/lib/landing-data";

export default function Pricing() {
  return (
    <section id="precos" className="px-4 py-16 sm:px-6 lg:px-10 lg:py-24">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1fr_0.9fr] lg:items-center lg:gap-16">
        <div>
          <span className="inline-flex items-center rounded-full border border-white/10 bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-widest text-indigo-300 backdrop-blur-md">
            Planos e preços
          </span>
          <h2 className="mt-3 text-3xl font-bold leading-tight tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent sm:text-4xl lg:text-5xl">
            Preço simples, sem surpresa
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-400 sm:text-base">
            Um único plano com tudo o que a sua clínica precisa para receber, agendar e acompanhar
            pacientes. Escolha a moeda do seu país.
          </p>

          <div className="mt-7 inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1 backdrop-blur-md">
            {PLANS.map((plan) => (
              <Link
                key={plan.id}
                href={`/precos?utm_source=saudesync&utm_medium=landing&utm_campaign=pricing-${plan.id}`}
                className="rounded-full px-5 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white"
              >
                {plan.flag} {plan.id === "br" ? "Real" : "Metical"}
              </Link>
            ))}
          </div>

          <ul className="mt-8 space-y-3">
            {ADDONS.map((addon) => (
              <li key={addon.name} className="flex items-start gap-3 text-sm text-slate-400">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-500/15 text-indigo-300">
                  <Check size={12} />
                </span>
                <span>
                  <span className="font-medium text-slate-100">{addon.name}</span>
                  {" — "}
                  {addon.description}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-4">
          {PLANS.map((plan, index) => (
            <div
              key={plan.id}
              className={`relative overflow-hidden rounded-3xl p-7 backdrop-blur-md transition duration-300 sm:p-8 ${
                index === 0
                  ? "border border-indigo-400/40 bg-gradient-to-br from-indigo-500/15 via-white/[0.04] to-violet-500/10 shadow-2xl shadow-indigo-500/20"
                  : "border border-white/10 bg-white/5 shadow-lg shadow-black/20 hover:border-white/20"
              }`}
            >
              {index === 0 && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-indigo-500/25 blur-3xl"
                />
              )}

              <div className="relative flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-400">
                    {plan.flag} {plan.country}
                  </p>
                  <h3 className="mt-1 text-lg font-bold tracking-tight text-white">
                    SaúdeSync Base
                  </h3>
                </div>
                {index === 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-md">
                    <Sparkles size={13} className="text-indigo-300" />
                    Mais Popular
                  </span>
                )}
              </div>

              <p className="relative mt-6 text-4xl font-bold tracking-tight text-white">
                <span className="text-indigo-300">{plan.currency}</span>{" "}
                {plan.price}
                <span className="text-base font-medium text-slate-400">
                  /{plan.cadence}
                </span>
              </p>

              <ul className="relative mt-6 space-y-3">
                {plan.includes.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-3 text-sm text-slate-300"
                  >
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                        index === 0
                          ? "bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] text-white"
                          : "bg-white/10 text-indigo-300"
                      }`}
                    >
                      <Check size={12} />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>

              <Link
                href={ctaUrl(`pricing-${plan.id}`)}
                className={`relative mt-7 flex w-full items-center justify-center rounded-full px-6 py-3 text-sm font-semibold transition duration-300 ${
                  index === 0
                    ? "bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] text-white shadow-lg shadow-indigo-500/25 hover:brightness-110 hover:shadow-indigo-500/40"
                    : "border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                }`}
              >
                Começar agora
              </Link>
            </div>
          ))}
          <p className="text-center text-xs text-slate-500">
            Sem taxa de setup. Cancele quando quiser.
          </p>
        </div>
      </div>
    </section>
  );
}
