"use client";

import { useState, useEffect, FormEvent } from "react";

interface Clinic {
  id: number;
  name: string;
  address: string;
  phone: string;
  whatsapp: string;
  opening_hours: string;
  location: string;
}

interface Social {
  instagram: string;
  facebook: string;
}

const EMPTY: Clinic = {
  id: 0,
  name: "",
  address: "",
  phone: "",
  whatsapp: "",
  opening_hours: "",
  location: "",
};

const EMPTY_SOCIAL: Social = { instagram: "", facebook: "" };

// Lê a coluna social_media (JSON em texto) para os campos individuais do
// form. Valor ausente, vazio ou inválido nunca quebra o carregamento.
function parseSocial(raw: unknown): Social {
  if (typeof raw !== "string" || !raw) return EMPTY_SOCIAL;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      const record = parsed as Record<string, unknown>;
      return {
        instagram: typeof record.instagram === "string" ? record.instagram : "",
        facebook: typeof record.facebook === "string" ? record.facebook : "",
      };
    }
  } catch {
    // JSON inválido guardado no passado: começa vazio, sem erro.
  }
  return EMPTY_SOCIAL;
}

export default function ClinicaPage() {
  const [form, setForm] = useState<Clinic>(EMPTY);
  const [social, setSocial] = useState<Social>(EMPTY_SOCIAL);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void fetch("/api/clinica")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          const { social_media: rawSocial, ...rest } = data;
          setForm({ ...EMPTY, ...rest });
          setSocial(parseSocial(rawSocial));
          setLoaded(true);
        }
      });
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    const res = await fetch("/api/clinica", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      // O backend recebe o objeto e stringifica para a coluna social_media.
      body: JSON.stringify({ ...form, social_media: social }),
    });
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
    setSaving(false);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold dark:text-white text-slate-900">Clínica</h1>
        <p className="text-sm mt-1 dark:text-slate-400 text-slate-500">
          Dados cadastrais da clínica usados nas confirmações e lembretes.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-2xl p-5 space-y-4" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
        <div>
          <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-200">Nome da clínica</label>
          <input
            aria-label="Nome da clínica"
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 placeholder:text-slate-400 focus:border-[#4f6df5]"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-200">Endereço</label>
          <input
            aria-label="Endereço"
            type="text"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 placeholder:text-slate-400 focus:border-[#4f6df5]"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-200">Telefone</label>
            <input
              aria-label="Telefone"
              type="text"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 placeholder:text-slate-400 focus:border-[#4f6df5]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-200">WhatsApp</label>
            <input
              aria-label="WhatsApp"
              type="text"
              value={form.whatsapp}
              onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
              className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 placeholder:text-slate-400 focus:border-[#4f6df5]"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-200">Horário de funcionamento</label>
          <input
            aria-label="Horário de funcionamento"
            type="text"
            value={form.opening_hours}
            onChange={(e) => setForm({ ...form, opening_hours: e.target.value })}
            placeholder="Segunda a Sexta: 08h às 18h"
            className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 placeholder:text-slate-400 focus:border-[#4f6df5]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-200">Localização</label>
          <input
            aria-label="Localização"
            type="text"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 placeholder:text-slate-400 focus:border-[#4f6df5]"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-200">Instagram</label>
            <input
              aria-label="Instagram"
              type="text"
              value={social.instagram}
              onChange={(e) => setSocial({ ...social, instagram: e.target.value })}
              placeholder="https://instagram.com/suaclinica"
              className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 placeholder:text-slate-400 focus:border-[#4f6df5]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-200">Facebook</label>
            <input
              aria-label="Facebook"
              type="text"
              value={social.facebook}
              onChange={(e) => setSocial({ ...social, facebook: e.target.value })}
              placeholder="https://facebook.com/suaclinica"
              className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 placeholder:text-slate-400 focus:border-[#4f6df5]"
            />
          </div>
        </div>

        {saved && <p className="text-sm text-emerald-600">Dados salvos com sucesso.</p>}
        <button
          type="submit"
          disabled={saving || !loaded}
          className="rounded-lg bg-primary hover:bg-primary-dark text-white font-medium px-4 py-2 text-sm disabled:opacity-50 transition-colors"
        >
          {saving ? "Salvando..." : "Salvar"}
        </button>
      </form>
    </div>
  );
}
