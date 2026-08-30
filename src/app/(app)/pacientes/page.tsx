"use client";

import { useState, useEffect, useCallback, FormEvent } from "react";

interface Patient {
  id: number;
  nome: string;
  telefone: string;
  email: string | null;
  data_nascimento: string | null;
  endereco: string | null;
  observacoes: string | null;
}

const EMPTY: Omit<Patient, "id"> = {
  nome: "",
  telefone: "",
  email: "",
  data_nascimento: "",
  endereco: "",
  observacoes: "",
};

export default function PacientesPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  const load = useCallback(async () => {
    setFetching(true);
    const res = await fetch("/api/pacientes");
    if (res.ok) {
      setPatients(await res.json());
    }
    setFetching(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function resetForm() {
    setForm(EMPTY);
    setError("");
  }

  function clearFeedback() {
    setError("");
    setSuccess("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    clearFeedback();

    const res = await fetch("/api/pacientes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: form.nome,
        telefone: form.telefone,
        email: form.email || undefined,
        data_nascimento: form.data_nascimento || undefined,
        endereco: form.endereco || undefined,
        observacoes: form.observacoes || undefined,
      }),
    });

    const data = await res.json().catch(() => null);

    if (res.ok) {
      resetForm();
      setSuccess("Paciente cadastrado com sucesso.");
      load();
      setTimeout(() => setSuccess(""), 3000);
    } else {
      setError(data?.error ?? "Erro ao cadastrar paciente.");
    }

    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Pacientes</h1>
        <p className="text-sm text-slate-500 mt-1">
          Cadastro e gestão de pacientes da clínica.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
        <h2 className="font-semibold text-slate-900">Novo paciente</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nome *</label>
            <input
              type="text"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Telefone *</label>
            <input
              type="tel"
              value={form.telefone}
              onChange={(e) => setForm({ ...form, telefone: e.target.value })}
              placeholder="+258 8X XXX XXXX"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">E-mail</label>
            <input
              type="email"
              value={form.email ?? ""}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Data de nascimento</label>
            <input
              type="date"
              value={form.data_nascimento ?? ""}
              onChange={(e) => setForm({ ...form, data_nascimento: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Endereço</label>
            <input
              type="text"
              value={form.endereco ?? ""}
              onChange={(e) => setForm({ ...form, endereco: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Observações</label>
            <textarea
              value={form.observacoes ?? ""}
              onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
              rows={2}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-emerald-600">{success}</p>}
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-primary hover:bg-primary-dark text-white font-medium px-4 py-2 text-sm disabled:opacity-50 transition-colors"
        >
          {loading ? "Salvando..." : "Cadastrar"}
        </button>
      </form>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {fetching ? (
          <div className="p-6 space-y-3">
            <div className="h-4 bg-slate-100 rounded animate-pulse w-1/3" />
            <div className="h-4 bg-slate-100 rounded animate-pulse w-1/2" />
            <div className="h-4 bg-slate-100 rounded animate-pulse w-2/5" />
          </div>
        ) : patients.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-sm text-slate-400">Nenhum paciente cadastrado.</p>
            <p className="text-xs text-slate-300 mt-1">Use o formulário acima para cadastrar o primeiro paciente.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-column-header text-left text-white">
                <tr>
                  <th className="px-4 py-3 font-medium">Nome</th>
                  <th className="px-4 py-3 font-medium">Telefone</th>
                  <th className="px-4 py-3 font-medium">E-mail</th>
                  <th className="px-4 py-3 font-medium">Data de nasc.</th>
                  <th className="px-4 py-3 font-medium">Endereço</th>
                </tr>
              </thead>
              <tbody>
                {patients.map((p) => (
                  <tr key={p.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-900">{p.nome}</td>
                    <td className="px-4 py-3 text-slate-600">{p.telefone}</td>
                    <td className="px-4 py-3 text-slate-600">{p.email || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {p.data_nascimento
                        ? new Date(p.data_nascimento).toLocaleDateString("pt-BR")
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{p.endereco || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
