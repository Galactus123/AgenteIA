"use client";

import { useState, useEffect, useCallback, FormEvent } from "react";

interface ScheduleRow {
  weekday: number;
  enabled: boolean;
  start_time: string;
  end_time: string;
}

interface Doctor {
  id: number;
  name: string;
  specialty_id: number;
  specialty_name: string;
  consultation_duration: number;
  price: number;
  status: string;
  phone: string;
  schedule: { id: number; doctor_id: number; weekday: number; start_time: string; end_time: string }[];
}

interface Specialty {
  id: number;
  name: string;
}

const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const EMPTY_SCHEDULE: ScheduleRow[] = Array.from({ length: 7 }, (_, weekday) => ({
  weekday,
  enabled: false,
  start_time: "08:00",
  end_time: "12:00",
}));

const EMPTY: Doctor = {
  id: 0,
  name: "",
  specialty_id: 0,
  specialty_name: "",
  consultation_duration: 30,
  price: 0,
  status: "active",
  phone: "",
  schedule: [],
};

export default function MedicosPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [form, setForm] = useState<Doctor>(EMPTY);
  const [schedule, setSchedule] = useState<ScheduleRow[]>(EMPTY_SCHEDULE);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const [docRes, specRes] = await Promise.all([
      fetch("/api/medicos"),
      fetch("/api/especialidades"),
    ]);
    if (docRes.ok) setDoctors(await docRes.json());
    if (specRes.ok) setSpecialties(await specRes.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function startEdit(d: Doctor) {
    setEditing(true);
    setForm({ ...d });
    const rows = EMPTY_SCHEDULE.map((row) => {
      const match = d.schedule.find((s) => s.weekday === row.weekday);
      return match
        ? { ...row, enabled: true, start_time: match.start_time, end_time: match.end_time }
        : row;
    });
    setSchedule(rows);
    setError("");
  }

  function resetForm() {
    setEditing(false);
    setForm(EMPTY);
    setSchedule(EMPTY_SCHEDULE);
    setError("");
  }

  function updateScheduleRow(weekday: number, patch: Partial<ScheduleRow>) {
    setSchedule((rows) => rows.map((r) => (r.weekday === weekday ? { ...r, ...patch } : r)));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const payload = {
      name: form.name,
      specialty_id: form.specialty_id,
      consultation_duration: form.consultation_duration,
      price: form.price,
      status: form.status,
      phone: form.phone,
      schedule: schedule
        .filter((r) => r.enabled && r.start_time && r.end_time)
        .map((r) => ({ weekday: r.weekday, start_time: r.start_time, end_time: r.end_time })),
    };
    const res = editing
      ? await fetch(`/api/medicos/${form.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      : await fetch("/api/medicos", {
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
    if (!confirm("Excluir este médico?")) return;
    const res = await fetch(`/api/medicos/${id}`, { method: "DELETE" });
    if (res.ok) load();
  }

  async function toggleStatus(d: Doctor) {
    await fetch(`/api/medicos/${d.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: d.status === "active" ? "inactive" : "active" }),
    });
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
          <h2 className="font-semibold text-slate-900">{editing ? "Editar médico" : "Novo médico"}</h2>
          {editing && (
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
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Especialidade</label>
            <select
              value={form.specialty_id}
              onChange={(e) => setForm({ ...form, specialty_id: Number(e.target.value) })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              required
            >
              <option value={0} disabled>
                Selecione...
              </option>
              {specialties.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
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
              value={form.consultation_duration}
              onChange={(e) => setForm({ ...form, consultation_duration: Number(e.target.value) })}
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
              value={form.price}
              onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
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
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Telefone / WhatsApp
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
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
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-primary hover:bg-primary-dark text-white font-medium px-4 py-2 text-sm disabled:opacity-50 transition-colors"
        >
          {loading ? "Salvando..." : editing ? "Salvar alterações" : "Cadastrar"}
        </button>
      </form>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {doctors.length === 0 ? (
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
                    <td className="px-4 py-3 font-medium text-slate-900">{d.name}</td>
                    <td className="px-4 py-3 text-slate-600">{d.specialty_name}</td>
                    <td className="px-4 py-3 text-slate-600">{d.phone || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{d.consultation_duration} min</td>
                    <td className="px-4 py-3 text-slate-600">
                      {d.price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleStatus(d)}
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          d.status === "active"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-500"
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
