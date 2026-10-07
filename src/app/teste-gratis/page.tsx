"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { SPECIALTIES } from "@/lib/landing-data";

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary";

// Atribuição vinda dos CTAs de /precos (?plan= e ?utm_source=). Lida no
// momento do envio: o formulário não precisa de a mostrar, então não há
// estado reativo nem efeito — só query string da própria página.
function readAttribution(): { plan?: string; utmSource?: string } {
  const params = new URLSearchParams(window.location.search);
  const plan = params.get("plan");
  const utmSource = params.get("utm_source");
  return { plan: plan ?? undefined, utmSource: utmSource ?? undefined };
}

export default function TesteGratisPage() {
  const [clinica, setClinica] = useState("");
  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [pais, setPais] = useState("br");
  const [especialidade, setEspecialidade] = useState(SPECIALTIES[0].name);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clinicName: clinica,
          contactName: nome,
          whatsapp,
          country: pais,
          specialty: especialidade,
          email: email || undefined,
          ...readAttribution(),
          source: "teste-gratis",
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Não foi possível enviar. Tente novamente.");
        return;
      }
      setSent(true);
    } catch {
      setError("Sem ligação à internet. Verifique a rede e tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-accent text-sidebar text-2xl font-bold">
              S
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
            <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-highlight text-primary-dark">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-7 w-7"
                aria-hidden="true"
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <h1 className="mt-6 text-2xl font-bold text-slate-900">
              Recebemos seu pedido!
            </h1>
            <p className="mt-3 text-sm text-slate-600">
              Nossa equipe vai falar com você no WhatsApp.
            </p>
          </div>
          <p className="text-xs text-slate-400 text-center mt-4">
            Já tem conta?{" "}
            <Link href="/login" className="text-primary-dark hover:text-primary">
              Entrar
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-accent text-sidebar text-2xl font-bold mb-4">
            S
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            Comece agora
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Ative sua recepção virtual no WhatsApp em minutos.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Nome da clínica
            </label>
            <input
              aria-label="Nome da clínica"
              type="text"
              value={clinica}
              onChange={(e) => setClinica(e.target.value)}
              className={inputClass}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Seu nome
            </label>
            <input
              aria-label="Seu nome"
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className={inputClass}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              WhatsApp
            </label>
            <input
              aria-label="WhatsApp"
              type="tel"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              className={inputClass}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              País
            </label>
            <select
              aria-label="País"
              value={pais}
              onChange={(e) => setPais(e.target.value)}
              className={inputClass}
              required
            >
              <option value="br">Brasil 🇧🇷</option>
              <option value="mz">Moçambique 🇲🇿</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Especialidade principal
            </label>
            <select
              aria-label="Especialidade principal"
              value={especialidade}
              onChange={(e) => setEspecialidade(e.target.value)}
              className={inputClass}
              required
            >
              {SPECIALTIES.map((specialty) => (
                <option key={specialty.slug} value={specialty.name}>
                  {specialty.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              E-mail <span className="font-normal text-slate-400">(opcional)</span>
            </label>
            <input
              aria-label="E-mail (opcional)"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </div>
          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary hover:bg-primary-dark text-white font-medium py-2 text-sm disabled:opacity-50 transition-colors"
          >
            {loading ? "Enviando..." : "Começar agora"}
          </button>
        </form>

        <p className="text-xs text-slate-400 text-center mt-4">
          Já tem conta?{" "}
          <Link href="/login" className="text-primary-dark hover:text-primary">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
