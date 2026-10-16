"use client";

import { useState, useEffect, useCallback, useRef, FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { usePlan } from "@/hooks/usePlan";
import UpgradeModal from "@/components/UpgradeModal";

interface Patient {
  id: string;
  nome: string;
  telefone: string;
  email: string | null;
  data_nascimento: string | null;
  endereco: string | null;
  observacoes: string | null;
}

// Linha crua de GET /api/pacientes: as colunas do Supabase sao em ingles
// (name, phone, date_of_birth, address, notes) e a UI usa os rotulos PT.
interface PatientRow {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  date_of_birth: string | null;
  address: string | null;
  notes: string | null;
}

function toPatient(row: PatientRow): Patient {
  return {
    id: row.id,
    nome: row.name ?? "",
    telefone: row.phone ?? "",
    email: row.email,
    data_nascimento: row.date_of_birth,
    endereco: row.address,
    observacoes: row.notes,
  };
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
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const { hasActivePlan } = usePlan();

  // Deep link da busca global: /pacientes?id=<uuid>.
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("id");
  const scrolledToHighlight = useRef<string | null>(null);

  const load = useCallback(async () => {
    setFetching(true);
    const res = await fetch("/api/pacientes");
    if (res.ok) {
      const data: unknown = await res.json();
      setPatients(Array.isArray(data) ? (data as PatientRow[]).map(toPatient) : []);
    }
    setFetching(false);
  }, []);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  // Rola até a linha vinda da busca (uma vez por id; as próximas recargas
  // da lista não voltam a puxar a página).
  useEffect(() => {
    if (fetching || !highlightId) return;
    if (scrolledToHighlight.current === highlightId) return;
    scrolledToHighlight.current = highlightId;
    document
      .getElementById(`paciente-${highlightId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [fetching, highlightId]);

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
    // Modo de visualização: cadastro cancelado e UpgradeModal aberto.
    if (!hasActivePlan) {
      setUpgradeOpen(true);
      return;
    }
    setLoading(true);
    clearFeedback();

    const res = await fetch("/api/pacientes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.nome,
        phone: form.telefone,
        email: form.email || undefined,
        date_of_birth: form.data_nascimento || undefined,
        address: form.endereco || undefined,
        notes: form.observacoes || undefined,
      }),
    });

    const data = await res.json().catch(() => null);

    if (res.ok) {
      resetForm();
      setSuccess("Paciente cadastrado com sucesso.");
      await load();
      setTimeout(() => setSuccess(""), 3000);
    } else {
      setError(data?.error ?? "Erro ao cadastrar paciente.");
    }

    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold dark:text-white text-slate-900">Pacientes</h1>
        <p className="text-sm mt-1 dark:text-slate-400 text-slate-500">
          Cadastro e gestão de pacientes da clínica.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-2xl p-5 space-y-4" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
        <h2 className="font-semibold dark:text-white text-slate-900">Novo paciente</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-200">Nome *</label>
            <input
              aria-label="Nome"
              type="text"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 px-3 py-2 text-sm focus:outline-none focus:border-[#4f6df5] focus:ring-1 focus:ring-[#4f6df5]"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-200">Telefone *</label>
            <input
              aria-label="Telefone"
              type="tel"
              value={form.telefone}
              onChange={(e) => setForm({ ...form, telefone: e.target.value })}
              placeholder="+258 8X XXX XXXX"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 px-3 py-2 text-sm focus:outline-none focus:border-[#4f6df5] focus:ring-1 focus:ring-[#4f6df5]"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-200">E-mail</label>
            <input
              aria-label="E-mail"
              type="email"
              value={form.email ?? ""}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 px-3 py-2 text-sm focus:outline-none focus:border-[#4f6df5] focus:ring-1 focus:ring-[#4f6df5]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-200">Data de nascimento</label>
            <input
              aria-label="Data de nascimento"
              type="date"
              value={form.data_nascimento ?? ""}
              onChange={(e) => setForm({ ...form, data_nascimento: e.target.value })}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 px-3 py-2 text-sm focus:outline-none focus:border-[#4f6df5] focus:ring-1 focus:ring-[#4f6df5]"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-200">Endereço</label>
            <input
              aria-label="Endereço"
              type="text"
              value={form.endereco ?? ""}
              onChange={(e) => setForm({ ...form, endereco: e.target.value })}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 px-3 py-2 text-sm focus:outline-none focus:border-[#4f6df5] focus:ring-1 focus:ring-[#4f6df5]"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-200">Observações</label>
            <textarea
              aria-label="Observações"
              value={form.observacoes ?? ""}
              onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
              rows={2}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 px-3 py-2 text-sm focus:outline-none focus:border-[#4f6df5] focus:ring-1 focus:ring-[#4f6df5]"
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

      <div className="rounded-2xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
        {fetching ? (
          <div className="p-6 space-y-3">
            <div className="h-4 rounded animate-pulse w-1/3 bg-slate-100 dark:bg-white/5" />
            <div className="h-4 rounded animate-pulse w-1/2 bg-slate-100 dark:bg-white/5" />
            <div className="h-4 rounded animate-pulse w-2/5 bg-slate-100 dark:bg-white/5" />
          </div>
        ) : patients.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">Nenhum paciente cadastrado.</p>
            <p className="text-xs mt-1 text-slate-500 dark:text-slate-400">Use o formulário acima para cadastrar o primeiro paciente.</p>
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
                  <tr
                    key={p.id}
                    id={`paciente-${p.id}`}
                    className={`border-t ${
                      p.id === highlightId ? "bg-indigo-50 dark:bg-indigo-500/10" : ""
                    }`}
                    style={{ borderColor: "var(--surface-border)" }}
                  >
                    <td className="px-4 py-3 font-medium dark:text-white text-slate-900">{p.nome}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{p.telefone}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{p.email || "—"}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                      {p.data_nascimento
                        ? new Date(p.data_nascimento).toLocaleDateString("pt-BR")
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{p.endereco || "—"}</td>
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
