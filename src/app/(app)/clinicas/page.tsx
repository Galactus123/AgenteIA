"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Building2, Plus, Loader2 } from "lucide-react";
import { clinicRoleLabel } from "@/lib/clinic-roles";
import type { ClinicListItem, ClinicsResponse } from "@/lib/types";

// ── Multi-clínica (Fase 1): Minhas Clínicas ────────────────────────────────
// Lista os vínculos do utilizador, troca a clínica ativa (mesmo PATCH do
// seletor do header) e cria novas clínicas. Página isenta de assinatura
// (CLINICS_PATH): é meta-operação da conta — quem troca para uma clínica
// sem assinatura precisa conseguir voltar/gerir daqui.
export default function MinhasClinicasPage() {
  const router = useRouter();
  const [data, setData] = useState<ClinicsResponse | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [switchingTo, setSwitchingTo] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    fetch("/api/clinics", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((payload: ClinicsResponse | null) => {
        if (!payload) return;
        setData(payload);
        setLoaded(true);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function switchTo(clinicId: number) {
    setSwitchingTo(clinicId);
    setError(null);
    try {
      const res = await fetch("/api/clinics/active", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinicId }),
      });
      if (!res.ok) {
        const payload: { error?: string } | null = await res.json().catch(() => null);
        throw new Error(payload?.error ?? "Não foi possível trocar de clínica.");
      }
      setData((prev) =>
        prev
          ? {
              clinics: prev.clinics.map((clinic) => ({
                ...clinic,
                isCurrent: clinic.id === clinicId,
              })),
              currentClinicId: clinicId,
            }
          : prev
      );
      // Cookie novo gravado pelo PATCH: revalida o servidor com a clínica
      // escolhida (dados, gate de assinatura e header).
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Não foi possível trocar de clínica."
      );
    } finally {
      setSwitchingTo(null);
    }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || creating) return;

    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/clinics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const payload: { clinic?: { id: number }; error?: string } | null = await res
        .json()
        .catch(() => null);
      if (!res.ok || !payload?.clinic) {
        throw new Error(payload?.error ?? "Não foi possível criar a clínica.");
      }
      setName("");
      // Sem nenhuma clínica ativa, ativa a recém-criada — senão o painel
      // ficaria sem clínica resolvida mesmo com o vínculo novo existente.
      if (data?.currentClinicId === null || data?.currentClinicId === undefined) {
        await switchTo(payload.clinic.id);
      }
      load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Não foi possível criar a clínica."
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold dark:text-white text-slate-900">Minhas Clínicas</h1>
        <p className="text-sm mt-1 dark:text-slate-400 text-slate-500">
          Alterne entre as clínicas da sua conta ou crie uma nova. A clínica
          ativa é a que aparece em todo o painel — agenda, pacientes e
          assinatura.
        </p>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {!loaded && (
        <p
          className="rounded-2xl p-5 text-sm"
          style={{ background: "var(--card)", border: "1px solid var(--card-border)", color: "var(--text-muted)" }}
        >
          A carregar as suas clínicas…
        </p>
      )}

      {loaded && data && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {data.clinics.map((clinic: ClinicListItem) => (
            <div
              key={clinic.id}
              className="rounded-2xl p-5 flex flex-col gap-4"
              style={{
                background: "var(--card)",
                border:
                  clinic.id === data.currentClinicId
                    ? "1px solid rgba(79,109,245,0.45)"
                    : "1px solid var(--card-border)",
                boxShadow:
                  clinic.id === data.currentClinicId
                    ? "0 0 24px rgba(79,109,245,0.12)"
                    : "var(--shadow-card)",
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Building2
                      size={16}
                      className="shrink-0"
                      style={{ color: "var(--color-primary)" }}
                    />
                    <h2 className="font-semibold truncate dark:text-white text-slate-900">
                      {clinic.name}
                    </h2>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="neon-badge">{clinicRoleLabel(clinic.role)}</span>
                    <span
                      className={
                        clinic.hasActiveSubscription
                          ? "neon-badge-success"
                          : "neon-badge-warning"
                      }
                    >
                      {clinic.hasActiveSubscription ? "Com assinatura" : "Sem assinatura"}
                    </span>
                  </div>
                </div>
                {clinic.id === data.currentClinicId && (
                  <span className="neon-badge shrink-0">Clínica ativa</span>
                )}
              </div>

              {clinic.id === data.currentClinicId ? (
                <a
                  href="/clinica"
                  className="mt-auto flex w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium transition-colors hover:opacity-80"
                  style={{ background: "var(--surface)", color: "var(--text-primary)", border: "1px solid var(--card-border)" }}
                >
                  Dados cadastrais
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => void switchTo(clinic.id)}
                  disabled={switchingTo !== null}
                  className="mt-auto flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
                >
                  {switchingTo === clinic.id && <Loader2 size={14} className="animate-spin" />}
                  {switchingTo === clinic.id ? "Acessando…" : "Acessar esta clínica"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <form
        onSubmit={handleCreate}
        className="rounded-2xl p-5 space-y-4"
        style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
      >
        <div>
          <h2 className="text-sm font-bold dark:text-white text-slate-900">Nova clínica</h2>
          <p className="mt-1 text-xs dark:text-slate-400 text-slate-500">
            Cada clínica tem a própria agenda, pacientes e assinatura. Clínicas
            novas começam sem assinatura — é preciso assinar para usá-las.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            aria-label="Nome da nova clínica"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            placeholder="Nome da clínica"
            className="flex-1 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 placeholder:text-slate-400 focus:border-[#4f6df5]"
          />
          <button
            type="submit"
            disabled={creating || !name.trim()}
            className="flex items-center justify-center gap-2 rounded-lg bg-primary hover:bg-primary-dark text-white font-medium px-4 py-2 text-sm disabled:opacity-50 transition-colors"
          >
            {creating ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Plus size={14} />
            )}
            {creating ? "Criando…" : "Criar clínica"}
          </button>
        </div>
      </form>
    </div>
  );
}
