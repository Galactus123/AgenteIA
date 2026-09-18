"use client";

import { useState, useEffect, useCallback, FormEvent } from "react";
import { supabase } from "@/lib/supabase";

interface ScheduleRow {
  weekday: number;
  enabled: boolean;
  start_time: string;
  end_time: string;
}

interface Professional {
  id: string;
  name: string;
  email: string;
  specialty_id: number | null;
  specialty_name: string;
  consultation_duration: number;
  price: number;
  status: string;
  phone: string;
  schedule: string[];
}

interface Specialty {
  id: number;
  name: string;
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
  name: "",
  email: "",
  specialty_id: "",
  phone: "",
  consultation_duration: 30,
  price: 0,
  status: "active",
};

export default function MedicosPage() {
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [schedule, setSchedule] = useState<ScheduleRow[]>(EMPTY_SCHEDULE);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    async function loadSpecialties() {
      const { data, error } = await supabase.from("specialties").select("*");
      if (error) console.error("Erro ao buscar especialidades:", error);
      else {
        console.log("Especialidades carregadas:", data);
        setSpecialties(data || []);
      }
    }
    loadSpecialties();
  }, []);

  const load = useCallback(async () => {
    setFetching(true);

    const { data, error } = await supabase
      .from("professionals")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setProfessionals(
        data.map((d: Record<string, unknown>) => ({
          id: d.id as string,
          name: d.name as string,
          email: (d.email as string) ?? "",
          specialty_id: d.specialty_id as number | null,
          specialty_name: (d.specialty_name as string) ?? "",
          consultation_duration: (d.consultation_duration as number) ?? 30,
          price: (d.price as number) ?? 0,
          status: (d.status as string) ?? "active",
          phone: (d.phone as string) ?? "",
          schedule: (d.schedule as string[]) ?? [],
        }))
      );
    }

    setFetching(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function startEdit(d: Professional) {
    setEditingId(d.id);
    setForm({
      name: d.name,
      email: d.email || "",
      specialty_id: String(d.specialty_id || ""),
      phone: d.phone,
      consultation_duration: d.consultation_duration,
      price: d.price,
      status: d.status,
    });
    const rows = EMPTY_SCHEDULE.map((row) => ({
      ...row,
      enabled: d.schedule.includes(DAY_LABELS[row.weekday]),
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

    const selectedDays = schedule
      .filter((r) => r.enabled)
      .map((r) => DAY_LABELS[r.weekday]);

    const selectedSpecialty = specialties.find(
      (s) => s.id === Number(form.specialty_id)
    );

    const payload = {
      name: form.name,
      email: form.email || "",
      phone: form.phone || "",
      specialty_id: form.specialty_id ? Number(form.specialty_id) : null,
      specialty_name: selectedSpecialty ? String(selectedSpecialty.name ?? "") : "",
      consultation_duration: Number(form.consultation_duration || 30),
      price: Number(form.price || 0),
      status: form.status || "active",
      schedule: selectedDays,
    };

    try {
      let result;

      if (editingId) {
        result = await supabase
          .from("professionals")
          .update(payload)
          .eq("id", editingId)
          .select()
          .single();
      } else {
        result = await supabase
          .from("professionals")
          .insert([payload])
          .select()
          .single();
      }

      if (result.error) {
        console.error("Erro ao salvar profissional:", result.error);
        setError(result.error.message ?? "Erro ao salvar profissional.");
      } else {
        resetForm();
        setSuccess(editingId ? "Profissional atualizado com sucesso!" : "Profissional cadastrado com sucesso!");
        await load();
        setTimeout(() => setSuccess(""), 3000);
      }
    } catch (err) {
      console.error("Erro ao enviar formulário de profissional:", err);
      setError("Erro de conexão ao salvar profissional.");
    }

    setLoading(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir este profissional?")) return;
    const { error: delError } = await supabase.from("professionals").delete().eq("id", id);
    if (!delError) load();
  }

  async function toggleStatus(d: Professional) {
    const newStatus = d.status === "active" ? "inactive" : "active";
    await supabase.from("professionals").update({ status: newStatus }).eq("id", d.id);
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold dark:text-white text-slate-900">Profissionais</h1>
        <p className="text-sm mt-1 dark:text-slate-400 text-slate-500">
          Cadastro de profissionais, especialidades, valores e horários de atendimento.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-2xl p-5 space-y-4" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold dark:text-white text-slate-900">{editingId ? "Editar profissional" : "Novo profissional"}</h2>
          {editingId && (
            <button type="button" onClick={resetForm} className="text-sm hover:underline dark:text-slate-400 text-slate-500">
              Cancelar edição
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1 dark:text-slate-300 text-slate-600">Nome</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none bg-[rgba(255,255,255,0.04)] text-white border-[rgba(99,102,241,0.1)] focus:border-[#4f6df5] focus:ring-1 focus:ring-[#4f6df5]"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 dark:text-slate-300 text-slate-600">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="profissional@exemplo.com"
              className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none bg-[rgba(255,255,255,0.04)] text-white border-[rgba(99,102,241,0.1)] focus:border-[#4f6df5] focus:ring-1 focus:ring-[#4f6df5]"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 dark:text-slate-300 text-slate-600">Especialidade</label>
            <select
              value={form.specialty_id || ""}
              onChange={(e) => setForm({ ...form, specialty_id: e.target.value })}
              className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none bg-[rgba(255,255,255,0.04)] text-white border-[rgba(99,102,241,0.1)] focus:border-[#4f6df5] focus:ring-1 focus:ring-[#4f6df5]"
              required
            >
              <option value="">Selecione...</option>
              {specialties.map((esp) => (
                <option key={esp.id} value={esp.id}>
                  {esp.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 dark:text-slate-300 text-slate-600">
              Duração da consulta (minutos)
            </label>
            <input
              type="number"
              min={10}
              step={5}
              value={form.consultation_duration}
              onChange={(e) => setForm({ ...form, consultation_duration: Number(e.target.value) })}
              className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none bg-[rgba(255,255,255,0.04)] text-white border-[rgba(99,102,241,0.1)] focus:border-[#4f6df5] focus:ring-1 focus:ring-[#4f6df5]"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 dark:text-slate-300 text-slate-600">Valor da consulta</label>
            <input
              type="number"
              min={0}
              step={10}
              value={form.price}
              onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
              className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none bg-[rgba(255,255,255,0.04)] text-white border-[rgba(99,102,241,0.1)] focus:border-[#4f6df5] focus:ring-1 focus:ring-[#4f6df5]"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 dark:text-slate-300 text-slate-600">Status</label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none bg-[rgba(255,255,255,0.04)] text-white border-[rgba(99,102,241,0.1)] focus:border-[#4f6df5] focus:ring-1 focus:ring-[#4f6df5]"
            >
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 dark:text-slate-300 text-slate-600">
              Telefone / WhatsApp
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+258 8X XXX XXXX"
              className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none bg-[rgba(255,255,255,0.04)] text-white border-[rgba(99,102,241,0.1)] focus:border-[#4f6df5] focus:ring-1 focus:ring-[#4f6df5]"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 dark:text-slate-300 text-slate-600">Dias e horários de atendimento</label>
          <div className="space-y-1.5">
            {schedule.map((row) => (
              <div key={row.weekday} className="flex items-center gap-3 text-sm">
                <label className="flex items-center gap-2 w-28">
                  <input
                    type="checkbox"
                    checked={row.enabled}
                    onChange={(e) => updateScheduleRow(row.weekday, { enabled: e.target.checked })}
                    className="rounded border-[rgba(99,102,241,0.1)] text-primary focus:ring-primary"
                  />
                  {DAY_LABELS[row.weekday]}
                </label>
                {row.enabled && (
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={row.start_time}
                      onChange={(e) => updateScheduleRow(row.weekday, { start_time: e.target.value })}
                      className="rounded-lg px-2 py-1 text-sm focus:outline-none bg-[rgba(255,255,255,0.04)] text-white border-[rgba(99,102,241,0.1)] focus:border-[#4f6df5] focus:ring-1 focus:ring-[#4f6df5]"
                    />
                    <span className="dark:text-slate-500 text-slate-400">até</span>
                    <input
                      type="time"
                      value={row.end_time}
                      onChange={(e) => updateScheduleRow(row.weekday, { end_time: e.target.value })}
                      className="rounded-lg px-2 py-1 text-sm focus:outline-none bg-[rgba(255,255,255,0.04)] text-white border-[rgba(99,102,241,0.1)] focus:border-[#4f6df5] focus:ring-1 focus:ring-[#4f6df5]"
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

      <div className="rounded-2xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
        {fetching ? (
          <div className="p-6 space-y-3">
            <div className="h-4 bg-slate-100 rounded animate-pulse w-1/3" />
            <div className="h-4 bg-slate-100 rounded animate-pulse w-1/2" />
            <div className="h-4 bg-slate-100 rounded animate-pulse w-2/5" />
          </div>
        ) : professionals.length === 0 ? (
          <p className="p-6 text-sm dark:text-slate-500 text-slate-400">Nenhum profissional cadastrado.</p>
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
                {professionals.map((d) => (
                  <tr key={d.id} style={{ borderTop: "1px solid var(--surface-border)" }}>
                    <td className="px-4 py-3 font-medium dark:text-white text-slate-900">{d.name}</td>
                    <td className="px-4 py-3 dark:text-slate-300 text-slate-600">{d.specialty_name}</td>
                    <td className="px-4 py-3 dark:text-slate-300 text-slate-600">{d.phone || "—"}</td>
                    <td className="px-4 py-3 dark:text-slate-300 text-slate-600">{d.consultation_duration} min</td>
                    <td className="px-4 py-3 dark:text-slate-300 text-slate-600">
                      {d.price.toLocaleString("pt-BR", { style: "currency", currency: "MZN" })}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleStatus(d)}
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          d.status === "active"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100"
                        }`}
                      >
                        {d.status === "active" ? "Ativo" : "Inativo"}
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
