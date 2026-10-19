"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Check, ChevronsUpDown, Layers, Loader2 } from "lucide-react";
import { clinicRoleLabel } from "@/lib/clinic-roles";
import type { ClinicListItem } from "@/lib/types";

interface ClinicSwitcherProps {
  // Nome usado até a lista carregar (o header continua com o mesmo default).
  fallbackName?: string;
  className?: string;
}

// Seletor de clínica ativa (Fase 1 multi-clínica): lista os vínculos do
// utilizador (GET /api/clinics), troca a ativa via PATCH /api/clinics/active
// e revalida os Server Components com router.refresh() — o novo cookie
// sd_active_clinic já vem no pedido seguinte e o layout/páginas voltam a
// resolver a clínica escolhida (gate de assinatura incluído).
export default function ClinicSwitcher({
  fallbackName = "SaúdeSync",
  className = "",
}: ClinicSwitcherProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [clinics, setClinics] = useState<ClinicListItem[] | null>(null);
  const [currentClinicId, setCurrentClinicId] = useState<number | null>(null);
  const [switchingTo, setSwitchingTo] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/clinics", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then(
        (data: { clinics?: ClinicListItem[]; currentClinicId?: number | null } | null) => {
          if (cancelled || !data?.clinics) return;
          setClinics(data.clinics);
          setCurrentClinicId(data.currentClinicId ?? null);
        }
      )
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Fecha o menu ao clicar fora ou com Escape.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const switchTo = useCallback(
    async (clinicId: number) => {
      if (clinicId === currentClinicId) {
        setOpen(false);
        return;
      }
      setSwitchingTo(clinicId);
      setError(null);
      try {
        const res = await fetch("/api/clinics/active", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clinicId }),
        });
        if (!res.ok) {
          const data: { error?: string } | null = await res.json().catch(() => null);
          throw new Error(data?.error ?? "Não foi possível trocar de clínica.");
        }
        setCurrentClinicId(clinicId);
        setClinics((prev) =>
          prev?.map((clinic) => ({ ...clinic, isCurrent: clinic.id === clinicId })) ?? null
        );
        setOpen(false);
        // Cookie já gravado no PATCH: revalida páginas/layout do servidor
        // (dados da nova clínica, gate de assinatura e nome exibido).
        router.refresh();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Não foi possível trocar de clínica."
        );
      } finally {
        setSwitchingTo(null);
      }
    },
    [currentClinicId, router]
  );

  const current = clinics?.find((clinic) => clinic.id === currentClinicId);
  const label = current?.name ?? fallbackName;

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Clínica atual: ${label}. Trocar de clínica`}
        className="flex items-center gap-2 rounded-xl px-3 py-2 min-h-[40px] text-sm font-medium transition-opacity hover:opacity-80"
        style={{
          color: "var(--text-primary)",
          background: "var(--surface)",
          border: "1px solid var(--card-border)",
        }}
      >
        <Building2
          size={15}
          strokeWidth={1.75}
          className="shrink-0"
          style={{ color: "var(--color-primary)" }}
        />
        <span className="max-w-[8.5rem] truncate sm:max-w-[12rem]">{label}</span>
        <ChevronsUpDown size={13} className="shrink-0 opacity-60" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Trocar de clínica"
          className="absolute right-0 z-50 mt-2 w-72 rounded-2xl p-2"
          style={{
            background: "var(--card)",
            border: "1px solid var(--card-border)",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <p
            className="px-2 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-muted)" }}
          >
            Suas clínicas
          </p>

          {clinics === null && (
            <p className="px-2 py-2 text-sm" style={{ color: "var(--text-muted)" }}>
              A carregar…
            </p>
          )}

          {clinics?.length === 0 && (
            <p className="px-2 py-2 text-sm" style={{ color: "var(--text-muted)" }}>
              Nenhuma clínica vinculada a esta conta.
            </p>
          )}

          {clinics?.map((clinic) => {
            const isActive = clinic.id === currentClinicId;
            const busy = switchingTo !== null;
            return (
              <button
                key={clinic.id}
                type="button"
                role="menuitemradio"
                aria-checked={isActive}
                disabled={busy}
                onClick={() => void switchTo(clinic.id)}
                className="w-full flex items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-left text-sm transition-colors hover:bg-[rgba(79,109,245,0.08)] disabled:opacity-60"
              >
                <span className="min-w-0 flex-1">
                  <span
                    className="block truncate font-medium"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {clinic.name}
                  </span>
                  <span className="block text-[11px]" style={{ color: "var(--text-muted)" }}>
                    {clinicRoleLabel(clinic.role)}
                    {" · "}
                    {clinic.hasActiveSubscription ? "Com assinatura" : "Sem assinatura"}
                  </span>
                </span>
                {switchingTo === clinic.id && (
                  <Loader2 size={14} className="shrink-0 animate-spin" />
                )}
                {isActive && switchingTo !== clinic.id && (
                  <Check
                    size={15}
                    className="shrink-0"
                    style={{ color: "var(--color-primary)" }}
                  />
                )}
              </button>
            );
          })}

          {error && (
            <p role="alert" className="px-2.5 py-1.5 text-xs text-red-500">
              {error}
            </p>
          )}

          <div
            className="mt-1 border-t pt-1"
            style={{ borderColor: "var(--card-border)" }}
          >
            <Link
              href="/clinicas"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-sm font-medium transition-colors hover:bg-[rgba(79,109,245,0.08)]"
              style={{ color: "var(--text-muted)" }}
            >
              <Layers size={15} />
              Gerir minhas clínicas
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
