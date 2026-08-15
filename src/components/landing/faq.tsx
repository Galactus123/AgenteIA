"use client";

import { useState } from "react";
import Link from "next/link";
import { FAQ_ITEMS, ctaUrl } from "@/lib/landing-data";

export default function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="py-20 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <span className="inline-block rounded-full bg-primary/15 text-primary-dark text-xs font-semibold tracking-wide uppercase px-3 py-1">
            FAQ
          </span>
          <h2 className="mt-4 text-3xl sm:text-4xl font-bold text-sidebar tracking-tight">
            Perguntas frequentes
          </h2>
        </div>

        <div className="mt-12 max-w-3xl mx-auto space-y-4">
          {FAQ_ITEMS.map((item, index) => {
            const open = openIndex === index;
            return (
              <div
                key={item.question}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(open ? null : index)}
                  aria-expanded={open}
                  className="w-full flex items-center justify-between gap-4 px-5 sm:px-6 py-4 text-left"
                >
                  <span className="font-medium text-sidebar">{item.question}</span>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`h-5 w-5 shrink-0 text-primary-dark transition-transform ${open ? "rotate-180" : ""}`}
                    aria-hidden="true"
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                {open && (
                  <div className="px-5 sm:px-6 pb-5">
                    <p className="text-sm text-slate-600 mt-2">{item.answer}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-12 text-center">
          <p className="text-slate-600">
            Ainda com dúvidas?{" "}
            <a
              href="#contato"
              className="font-medium text-primary-dark hover:text-primary underline underline-offset-4 transition-colors"
            >
              Fale conosco no WhatsApp
            </a>
          </p>
          <Link
            href={ctaUrl("faq")}
            className="mt-6 inline-flex items-center justify-center rounded-lg bg-primary hover:bg-primary-dark text-white font-medium px-6 py-3 transition-colors"
          >
            Começar agora
          </Link>
        </div>
      </div>
    </section>
  );
}
