"use client";

import { useState, useEffect, useCallback, useRef, FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { usePlan } from "@/hooks/usePlan";
import UpgradeModal from "@/components/UpgradeModal";

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
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const { hasActivePlan } = usePlan();

  // Deep link da busca global: /especialidades?id=<id> abre o registro.
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("id");
  // Um único carregamento por id: cancelar a edição não reabre o form.
  const appliedHighlight = useRef<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/especialidades");
    if (res.ok) setItems(await res.json());
  }, []);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  // Vindo da busca global: preenche o formulário com a especialidade e leva
  // a vista até ele.
  useEffect(() => {
    if (!highlightId || appliedHighlight.current === highlightId) return;
    if (items.length === 0) return;
    const target = items.find((s) => String(s.id) === highlightId);
    if (!target) return;
    appliedHighlight.current = highlightId;
    startEdit(target);
    document
      .getElementById("form-especialidade")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [highlightId, items]);

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
    // Modo de visualização: criação/edição cancelada e UpgradeModal aberto.
    if (!hasActivePlan) {
      setUpgradeOpen(true);
      return;
    }
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
      await load();
    } else {
      setError(data?.error ?? "Erro ao salvar.");
    }
    setLoading(false);
  }

  async function handleDelete(id: number) {
    if (!hasActivePlan) {
      setUpgradeOpen(true);
      return;
    }
    if (!confirm("Excluir esta especialidade?")) return;
    const res = await fetch(`/api/especialidades/${id}`, { method: "DELETE" });
    if (res.ok) await load();
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold dark:text-white text-slate-900">Especialidades</h1>
        <p className="text-sm mt-1 dark:text-slate-400 text-slate-500">
          Cadastro de especialidades e palavras-chave usadas pela IA para sugerir o atendimento.
        </p>
      </div>

      <form
        id="form-especialidade"
        onSubmit={handleSubmit}
        className="rounded-2xl p-5 space-y-4"
        style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-semibold dark:text-white text-slate-900">{editing ? "Editar especialidade" : "Nova especialidade"}</h2>
          {editing && (
            <button type="button" onClick={resetForm} className="text-sm dark:text-slate-400 text-slate-500">
              Cancelar edição
            </button>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-200">Nome</label>
          <input
            aria-label="Nome"
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 placeholder:text-slate-400 focus:border-[#4f6df5] focus:ring-1 focus:ring-[#4f6df5] focus:outline-none"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-200">Descrição</label>
          <textarea
            aria-label="Descrição"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={2}
            className="w-full rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 placeholder:text-slate-400 focus:border-[#4f6df5] focus:ring-1 focus:ring-[#4f6df5] focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-200">
            Palavras-chave (separadas por vírgula)
          </label>
          <input
            aria-label="Palavras-chave (separadas por vírgula)"
            type="text"
            value={keywordsText}
            onChange={(e) => setKeywordsText(e.target.value)}
            placeholder="ex.: dor de cabeça, febre, tosse"
            className="w-full rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 placeholder:text-slate-400 focus:border-[#4f6df5] focus:ring-1 focus:ring-[#4f6df5] focus:outline-none"
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

      <div className="rounded-2xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
        {items.length === 0 ? (
          <p className="p-6 text-sm dark:text-slate-400 text-slate-500">Nenhuma especialidade cadastrada.</p>
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
                  <tr key={s.id} className="border-t" style={{ borderColor: "var(--surface-border)" }}>
                    <td className="px-4 py-3">
                      <p className="font-medium dark:text-white text-slate-900">{s.name}</p>
                      <p className="text-xs line-clamp-1 dark:text-slate-400 text-slate-500">{s.description}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {s.keywords.slice(0, 5).map((k, i) => (
                          <span key={i} className="rounded-full px-2 py-0.5 text-xs text-slate-700 dark:text-slate-200" style={{ background: "rgba(99,102,241,0.1)" }}>
                            {k}
                          </span>
                        ))}
                        {s.keywords.length > 5 && (
                          <span className="text-xs dark:text-slate-400 text-slate-500">+{s.keywords.length - 5}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button onClick={() => startEdit(s)} className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline mr-3">
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

      <UpgradeModal isOpen={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
    </div>
  );
}
