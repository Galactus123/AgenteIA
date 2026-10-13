"use client";

import Link from "next/link";
import { Check, Sparkles } from "lucide-react";
import { ADDONS, PLANS, ctaUrl } from "@/lib/landing-data";

export default function Pricing() {
  return (
    <section id="precos" className="px-4 py-16 sm:px-6 lg:px-10 lg:py-24">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1fr_0.9fr] lg:items-center lg:gap-16">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#4f6df5]">
            Planos e preços
          </p>
          <h2 className="mt-3 text-3xl font-bold leading-tight tracking-tight text-slate-900 dark:text-white sm:text-4xl lg:text-5xl">
            Preço simples, sem surpresa
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-600 dark:text-slate-400 sm:text-base">
            Um único plano com tudo o que a sua clínica precisa para receber, agendar e acompanhar
            pacientes. Escolha a moeda do seu país.
          </p>

          <div className="mt-7 inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1 dark:border-white/10 dark:bg-[#161926]">
            {PLANS.map((plan) => (
              <Link
                key={plan.id}
                href={`/precos?utm_source=saudesync&utm_medium=landing&utm_campaign=pricing-${plan.id}`}
                className="rounded-full px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:text-[#4f6df5] dark:text-slate-300"
              >
                {plan.flag} {plan.id === "br" ? "Real" : "Metical"}
              </Link>
            ))}
          </div>

          <ul className="mt-8 space-y-3">
            {ADDONS.map((addon) => (
              <li key={addon.name} className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-400">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#4f6df5]/10 text-[#4f6df5]">
                  <Check size={12} />
                </span>
                <span>
                  <span className="font-medium text-slate-900 dark:text-white">{addon.name}</span>
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
              className={`rounded-[28px] border p-7 transition duration-300 sm:p-8 ${
                index === 0
                  ? "border-transparent bg-gradient-to-br from-[#4f6df5] via-[#6366f1] to-[#8b5cf6] text-white shadow-2xl shadow-[#4f6df5]/30"
                  : "border-slate-200 bg-white dark:border-white/10 dark:bg-[#161926]"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p
                    className={`text-sm font-semibold ${
                      index === 0 ? "text-white/80" : "text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    {plan.flag} {plan.country}
                  </p>
                  <h3
                    className={`mt-1 text-lg font-bold ${
                      index === 0 ? "text-white" : "text-slate-900 dark:text-white"
                    }`}
                  >
                    SaúdeSync Base
                  </h3>
                </div>
                {index === 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 text-xs font-semibold">
                    <Sparkles size={13} />
                    Popular
                  </span>
                )}
              </div>

              <p className="mt-6 text-4xl font-bold">
                <span className={index === 0 ? "text-white/80" : "text-[#4f6df5]"}>{plan.currency}</span>{" "}
                {plan.price}
                <span
                  className={`text-base font-medium ${
                    index === 0 ? "text-white/70" : "text-slate-400"
                  }`}
                >
                  /{plan.cadence}
                </span>
              </p>

              <ul className="mt-6 space-y-3">
                {plan.includes.map((item) => (
                  <li
                    key={item}
                    className={`flex items-start gap-3 text-sm ${
                      index === 0 ? "text-white/90" : "text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                        index === 0 ? "bg-white/25 text-white" : "bg-[#4f6df5]/10 text-[#4f6df5]"
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
                className={`mt-7 flex w-full items-center justify-center rounded-full px-6 py-3 text-sm font-semibold transition ${
                  index === 0
                    ? "bg-white text-slate-900 hover:bg-white/90"
                    : "bg-slate-900 text-white hover:bg-[#4f6df5] dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                }`}
              >
                Começar agora
              </Link>
            </div>
          ))}
          <p className="text-center text-xs text-slate-500 dark:text-slate-400">
            Sem taxa de setup. Cancele quando quiser.
          </p>
        </div>
      </div>
    </section>
  );
}
