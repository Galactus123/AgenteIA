"use client";

import { useState, useEffect, useCallback, FormEvent } from "react";

interface Specialty {
  id: number;
  name: string;
  description: string;
  keywords: string[];
}

const EMPTY: Specialty = { id: 0, name: "", description: "", keywords: [] };

export default function EspecialidadesPage() {
  const [items, setItems] = useState<Specialty[]>([]);
  const [form, setForm] = useState<Specialty>(EMPTY);
  const [editing, setEditing] = useState(false);
  const [keywordsText, setKeywordsText] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/especialidades");
    if (res.ok) setItems(await res.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function startEdit(s: Specialty) {
    setEditing(true);
    setForm({ ...s });
    setKeywordsText(s.keywords.join(", "));
    setError("");
  }

  function resetForm() {
    setEditing(false);
    setForm(EMPTY);
    setKeywordsText("");
    setError("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const payload = {
      name: form.name,
      description: form.description,
      keywords: keywordsText.split(",").map((k) => k.trim()).filter(Boolean),
    };
    const res = editing
      ? await fetch(`/api/especialidades/${form.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      : await fetch("/api/especialidades", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
    const data = await res.json().catch(() => null);
    if (res.ok) {
      resetForm();
      load();
    } else {
      setError(data?.error ?? "Erro ao salvar.");
    }
    setLoading(false);
  }

  async function handleDelete(id: number) {
    if (!confirm("Excluir esta especialidade?")) return;
    const res = await fetch(`/api/especialidades/${id}`, { method: "DELETE" });
    if (res.ok) load();
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Especialidades</h1>
        <p className="text-sm text-slate-500 mt-1">
          Cadastro de especialidades e palavras-chave usadas pela IA para sugerir o atendimento.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">{editing ? "Editar especialidade" : "Nova especialidade"}</h2>
          {editing && (
            <button type="button" onClick={resetForm} className="text-sm text-slate-500 hover:text-slate-700">
              Cancelar edição
            </button>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Nome</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={2}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Palavras-chave (separadas por vírgula)
          </label>
          <input
            type="text"
            value={keywordsText}
            onChange={(e) => setKeywordsText(e.target.value)}
            placeholder="ex.: dor de cabeça, febre, tosse"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-primary hover:bg-primary-dark text-white font-medium px-4 py-2 text-sm disabled:opacity-50 transition-colors"
        >
          {loading ? "Salvando..." : editing ? "Salvar alterações" : "Cadastrar"}
        </button>
      </form>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {items.length === 0 ? (
          <p className="p-6 text-sm text-slate-400">Nenhuma especialidade cadastrada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-column-header text-left text-white">
                <tr>
                  <th className="px-4 py-3 font-medium">Nome</th>
                  <th className="px-4 py-3 font-medium">Palavras-chave</th>
                  <th className="px-4 py-3 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {items.map((s) => (
                  <tr key={s.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{s.name}</p>
                      <p className="text-xs text-slate-500 line-clamp-1">{s.description}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {s.keywords.slice(0, 5).map((k, i) => (
                          <span key={i} className="bg-slate-100 text-slate-600 rounded-full px-2 py-0.5 text-xs">
                            {k}
                          </span>
                        ))}
                        {s.keywords.length > 5 && (
                          <span className="text-xs text-slate-400">+{s.keywords.length - 5}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button onClick={() => startEdit(s)} className="text-sm text-primary hover:underline mr-3">
                        Editar
                      </button>
                      <button onClick={() => handleDelete(s.id)} className="text-sm text-red-600 hover:underline">
                        Excluir
                      </button>
                    </td>
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
