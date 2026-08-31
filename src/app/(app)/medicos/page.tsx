"use client";

import { useState, useEffect, useCallback, FormEvent } from "react";
import { supabase } from "@/lib/supabase";

interface ScheduleRow {
  weekday: number;
  enabled: boolean;
  start_time: string;
  end_time: string;
}

interface Doctor {
  id: number;
  nome: string;
  especialidade_id: number;
  especialidade_nome: string;
  duracao_consulta: number;
  valor_consulta: number;
  status: string;
  telefone: string;
  dias_atendimento: string[];
}

interface Specialty {
  id: number;
  name?: string;
  nome?: string;
  [key: string]: unknown;
}

const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const EMPTY_SCHEDULE: ScheduleRow[] = Array.from({ length: 7 }, (_, weekday) => ({
  weekday,
  enabled: false,
  start_time: "08:00",
  end_time: "12:00",
}));

const EMPTY_FORM = {
  nome: "",
  especialidade_id: 0,
  telefone: "",
  duracao_consulta: 30,
  valor_consulta: 0,
  status: "Ativo",
};

export default function MedicosPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [especialidades, setEspecialidades] = useState<Specialty[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [schedule, setSchedule] = useState<ScheduleRow[]>(EMPTY_SCHEDULE);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    async function carregarEspecialidades() {
      const { data, error } = await supabase.from("especialidades").select("*");
      if (error) console.error("Erro ao buscar especialidades:", error);
      else {
        console.log("Especialidades carregadas:", data);
        setEspecialidades(data || []);
      }
    }
    carregarEspecialidades();
  }, []);

  const load = useCallback(async () => {
    setFetching(true);

    const { data: docRes } = await supabase
      .from("medicos")
      .select("*, especialidades(name)")
      .order("nome", { ascending: true });

    if (docRes) {
      setDoctors(
        docRes.map((d: Record<string, unknown>) => ({
          id: d.id as number,
          nome: d.nome as string,
          especialidade_id: d.especialidade_id as number,
          especialidade_nome: (d.especialidades as Record<string, unknown>)?.nome
            || (d.especialidades as Record<string, unknown>)?.name
            || "—",
          duracao_consulta: (d.duracao_consulta as number) ?? 30,
          valor_consulta: (d.valor_consulta as number) ?? 0,
          status: (d.status as string) ?? "Ativo",
          telefone: (d.telefone as string) ?? "",
          dias_atendimento: (d.dias_atendimento as string[]) ?? [],
        }))
      );
    }

    setFetching(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function startEdit(d: Doctor) {
    setEditingId(d.id);
    setForm({
      nome: d.nome,
      especialidade_id: d.especialidade_id,
      telefone: d.telefone,
      duracao_consulta: d.duracao_consulta,
      valor_consulta: d.valor_consulta,
      status: d.status,
    });
    const rows = EMPTY_SCHEDULE.map((row) => ({
      ...row,
      enabled: d.dias_atendimento.includes(DAY_LABELS[row.weekday]),
    }));
    setSchedule(rows);
    setError("");
    setSuccess("");
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setSchedule(EMPTY_SCHEDULE);
    setError("");
    setSuccess("");
  }

  function updateScheduleRow(weekday: number, patch: Partial<ScheduleRow>) {
    setSchedule((rows) => rows.map((r) => (r.weekday === weekday ? { ...r, ...patch } : r)));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    const diasAtendimento = schedule
      .filter((r) => r.enabled)
      .map((r) => DAY_LABELS[r.weekday]);

    const payload = {
      nome: form.nome,
      especialidade_id: form.especialidade_id || null,
      telefone: form.telefone || null,
      duracao_consulta: form.duracao_consulta,
      valor_consulta: form.valor_consulta,
      status: form.status,
      dias_atendimento: diasAtendimento,
    };

    try {
      let result;

      if (editingId) {
        result = await supabase
          .from("medicos")
          .update(payload)
          .eq("id", editingId)
          .select()
          .single();
      } else {
        result = await supabase
          .from("medicos")
          .insert([payload])
          .select()
          .single();
      }

      if (result.error) {
        console.error("Erro ao salvar médico:", result.error);
        setError(result.error.message ?? "Erro ao salvar médico.");
      } else {
        resetForm();
        setSuccess(editingId ? "Médico atualizado com sucesso!" : "Médico cadastrado com sucesso!");
        load();
        setTimeout(() => setSuccess(""), 3000);
      }
    } catch (err) {
      console.error("Erro ao enviar formulário de médico:", err);
      setError("Erro de conexão ao salvar médico.");
    }

    setLoading(false);
  }

  async function handleDelete(id: number) {
    if (!confirm("Excluir este médico?")) return;
    const { error: delError } = await supabase.from("medicos").delete().eq("id", id);
    if (!delError) load();
  }

  async function toggleStatus(d: Doctor) {
    const newStatus = d.status === "Ativo" ? "Inativo" : "Ativo";
    await supabase.from("medicos").update({ status: newStatus }).eq("id", d.id);
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Médicos</h1>
        <p className="text-sm text-slate-500 mt-1">
          Cadastro de médicos, especialidades, valores e horários de atendimento.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">{editingId ? "Editar médico" : "Novo médico"}</h2>
          {editingId && (
            <button type="button" onClick={resetForm} className="text-sm text-slate-500 hover:text-slate-700">
              Cancelar edição
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nome</label>
            <input
              type="text"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Especialidade</label>
            <select
              value={form.especialidade_id || ""}
              onChange={(e) => setForm({ ...form, especialidade_id: Number(e.target.value) })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              required
            >
              <option value="">Selecione...</option>
              {especialidades && especialidades.map((item) => (
                <option key={item.id || String(item)} value={item.id || String(item)}>
                  {(item as Record<string, unknown>).nome || (item as Record<string, unknown>).name || String(item)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Duração da consulta (minutos)
            </label>
            <input
              type="number"
              min={10}
              step={5}
              value={form.duracao_consulta}
              onChange={(e) => setForm({ ...form, duracao_consulta: Number(e.target.value) })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Valor da consulta</label>
            <input
              type="number"
              min={0}
              step={10}
              value={form.valor_consulta}
              onChange={(e) => setForm({ ...form, valor_consulta: Number(e.target.value) })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="Ativo">Ativo</option>
              <option value="Inativo">Inativo</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Telefone / WhatsApp
            </label>
            <input
              type="tel"
              value={form.telefone}
              onChange={(e) => setForm({ ...form, telefone: e.target.value })}
              placeholder="+258 8X XXX XXXX"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Dias e horários de atendimento</label>
          <div className="space-y-1.5">
            {schedule.map((row) => (
              <div key={row.weekday} className="flex items-center gap-3 text-sm">
                <label className="flex items-center gap-2 w-28">
                  <input
                    type="checkbox"
                    checked={row.enabled}
                    onChange={(e) => updateScheduleRow(row.weekday, { enabled: e.target.checked })}
                    className="rounded border-slate-300 text-primary focus:ring-primary"
                  />
                  {DAY_LABELS[row.weekday]}
                </label>
                {row.enabled && (
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={row.start_time}
                      onChange={(e) => updateScheduleRow(row.weekday, { start_time: e.target.value })}
                      className="rounded-lg border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <span className="text-slate-400">até</span>
                    <input
                      type="time"
                      value={row.end_time}
                      onChange={(e) => updateScheduleRow(row.weekday, { end_time: e.target.value })}
                      className="rounded-lg border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-emerald-600">{success}</p>}
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-primary hover:bg-primary-dark text-white font-medium px-4 py-2 text-sm disabled:opacity-50 transition-colors"
        >
          {loading ? "Salvando..." : editingId ? "Salvar alterações" : "Cadastrar"}
        </button>
      </form>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {fetching ? (
          <div className="p-6 space-y-3">
            <div className="h-4 bg-slate-100 rounded animate-pulse w-1/3" />
            <div className="h-4 bg-slate-100 rounded animate-pulse w-1/2" />
            <div className="h-4 bg-slate-100 rounded animate-pulse w-2/5" />
          </div>
        ) : doctors.length === 0 ? (
          <p className="p-6 text-sm text-slate-400">Nenhum médico cadastrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-column-header text-left text-white">
                <tr>
                  <th className="px-4 py-3 font-medium">Nome</th>
                  <th className="px-4 py-3 font-medium">Especialidade</th>
                  <th className="px-4 py-3 font-medium">Telefone</th>
                  <th className="px-4 py-3 font-medium">Duração</th>
                  <th className="px-4 py-3 font-medium">Valor</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {doctors.map((d) => (
                  <tr key={d.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-900">{d.nome}</td>
                    <td className="px-4 py-3 text-slate-600">{d.especialidade_nome}</td>
                    <td className="px-4 py-3 text-slate-600">{d.telefone || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{d.duracao_consulta} min</td>
                    <td className="px-4 py-3 text-slate-600">
                      {d.valor_consulta.toLocaleString("pt-BR", { style: "currency", currency: "MZN" })}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleStatus(d)}
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          d.status === "Ativo"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {d.status}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button onClick={() => startEdit(d)} className="text-sm text-primary hover:underline mr-3">
                        Editar
                      </button>
                      <button onClick={() => handleDelete(d.id)} className="text-sm text-red-600 hover:underline">
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
