"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Building2,
  CalendarDays,
  CornerDownLeft,
  CreditCard,
  LayoutDashboard,
  Loader2,
  Search,
  Sparkles,
  Stethoscope,
  Users,
} from "lucide-react";
import { SEARCH_MIN_CHARS } from "@/lib/search";
import type { SearchHit, SearchKind } from "@/lib/search";

// Busca global do dashboard: input da barra superior + dropdown combobox.
// Ctrl/Cmd+K abre e foca; a digitação vai à rota /api/search com debounce de
// 300ms; as setas/Enter/Esc navegam a lista sem tirar as mãos do teclado.
// Paleta feita só com tokens do tema (var(--*) + classes dark:) para servir
// os dois modos.

const DEBOUNCE_MS = 300;

const KIND_ICON = {
  paciente: Users,
  medico: Stethoscope,
  consulta: CalendarDays,
  especialidade: Sparkles,
} satisfies Record<SearchKind, typeof Users>;

interface Shortcut {
  label: string;
  href: string;
  icon: typeof Users;
}

// Atalhos mostrados com o campo vazio (atalhos de navegação das abas).
const SHORTCUTS: Shortcut[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Pacientes", href: "/pacientes", icon: Users },
  { label: "Profissionais", href: "/medicos", icon: Stethoscope },
  { label: "Consultas", href: "/consultas", icon: CalendarDays },
  { label: "Especialidades", href: "/especialidades", icon: Sparkles },
  { label: "Clínica", href: "/clinica", icon: Building2 },
  { label: "Assinatura", href: "/configuracoes/assinatura", icon: CreditCard },
];

const KIND_ORDER: SearchKind[] = ["paciente", "medico", "consulta", "especialidade"];

type Mode = "shortcuts" | "hint" | "loading" | "error" | "empty" | "results";

export default function GlobalSearch() {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  // Termo que produziu `hits`: diferente do termo atual significa que a
  // lista ainda nao reflete o que esta digitado (mostra o estado de busca).
  const [hitsQuery, setHitsQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(0);

  const term = query.trim();

  const mode: Mode =
    term.length === 0
      ? "shortcuts"
      : term.length < SEARCH_MIN_CHARS
        ? "hint"
        : failed
          ? "error"
          : loading || hitsQuery !== term
            ? "loading"
            : hits.length === 0
              ? "empty"
              : "results";

  const count =
    mode === "shortcuts"
      ? SHORTCUTS.length
      : mode === "results"
        ? hits.length
        : 0;
  // Ativo fora do intervalo atual (lista encolheu): cai no primeiro item.
  const safeActive = active < count ? active : 0;

  // Grupos fixos por categoria, com o índice inicial de cada um na lista
  // plana (é o que o teclado e o aria-activedescendant usam).
  const groups = useMemo(() => {
    const buckets = KIND_ORDER.map((kind) => ({
      kind,
      items: hits.filter((hit) => hit.kind === kind),
    }));
    return buckets
      .map((bucket, index) => ({
        ...bucket,
        // Soma dos anteriores: sem variável mutável durante o render.
        start: buckets.slice(0, index).reduce((sum, prev) => sum + prev.items.length, 0),
      }))
      .filter((bucket) => bucket.items.length > 0);
  }, [hits]);

  // Ctrl/Cmd+K: abre e foca o campo de qualquer lugar do dashboard.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Fecha ao clicar fora.
  useEffect(() => {
    if (!open) return;
    function onMouseDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  // Debounce de 300ms + AbortController: uma resposta atrasada de uma busca
  // anterior nunca sobrescreve a lista da busca corrente. Todo set de estado
  // acontece dentro de callback (regra react-hooks/set-state-in-effect).
  useEffect(() => {
    if (!open || term.length < SEARCH_MIN_CHARS) return;

    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      fetch(`/api/search?q=${encodeURIComponent(term)}`, {
        signal: controller.signal,
        cache: "no-store",
      })
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
        .then((data: { results?: SearchHit[] }) => {
          setHits(Array.isArray(data.results) ? data.results : []);
          setHitsQuery(term);
          setFailed(false);
          setActive(0);
        })
        .catch((err: unknown) => {
          if (err instanceof Error && err.name === "AbortError") return;
          setHits([]);
          setHitsQuery(term);
          setFailed(true);
          setActive(0);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, term]);

  // Mantém a opção ativa visível dentro do painel.
  useEffect(() => {
    if (!open) return;
    document
      .getElementById(`global-search-option-${safeActive}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [safeActive, open]);

  function choose(href: string) {
    setOpen(false);
    setQuery("");
    setHits([]);
    setActive(0);
    router.push(href);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (count > 0) setActive((i) => (i + 1) % count);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (count > 0) setActive((i) => (i - 1 + count) % count);
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (mode === "shortcuts") choose(SHORTCUTS[safeActive]?.href ?? SHORTCUTS[0].href);
      else if (hits[safeActive]) choose(hits[safeActive].href);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    }
  }

  const optionClass = (selected: boolean) =>
    `flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
      selected ? "bg-slate-100 dark:bg-white/10" : "hover:bg-slate-100 dark:hover:bg-white/5"
    }`;

  return (
    <div className="relative flex-1 max-w-md" ref={rootRef}>
      <Search
        size={16}
        strokeWidth={1.75}
        className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-slate-500 dark:text-slate-400"
      />
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls="global-search-panel"
        aria-autocomplete="list"
        aria-haspopup="listbox"
        aria-activedescendant={
          open && mode !== "hint" && mode !== "shortcuts"
            ? `global-search-option-${safeActive}`
            : undefined
        }
        aria-label="Buscar paciente, profissional, consulta ou especialidade"
        placeholder="Buscar..."
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          setActive(0);
          setFailed(false);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className="w-full rounded-xl py-2.5 pl-9 pr-3 text-sm transition-colors focus:border-[#4f6df5] focus:outline-none focus:ring-2 focus:ring-[#4f6df5]/30 sm:pr-16"
        style={{
          background: "var(--input-bg)",
          border: "1px solid var(--input-border)",
          color: "var(--foreground)",
        }}
      />
      <kbd
        className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-slate-500 dark:text-slate-400 sm:flex"
        style={{ background: "var(--surface)", border: "1px solid var(--input-border)" }}
        aria-hidden="true"
      >
        Ctrl K
      </kbd>

      {open && (
        <div
          id="global-search-panel"
          role="listbox"
          aria-label="Resultados da busca"
          className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[70vh] overflow-y-auto rounded-xl p-1.5"
          style={{
            background: "var(--card)",
            border: "1px solid var(--card-border)",
            boxShadow: "0 20px 45px rgba(15, 23, 42, 0.18)",
          }}
        >
          {mode === "shortcuts" && (
            <>
              <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Navegação rápida
              </p>
              {SHORTCUTS.map((shortcut, index) => {
                const Icon = shortcut.icon;
                return (
                  <button
                    key={shortcut.href}
                    id={`global-search-option-${index}`}
                    type="button"
                    role="option"
                    aria-selected={index === safeActive}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => choose(shortcut.href)}
                    className={optionClass(index === safeActive)}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
                      <Icon size={16} strokeWidth={1.75} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-900 dark:text-white">
                        {shortcut.label}
                      </span>
                      <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                        {shortcut.href}
                      </span>
                    </span>
                    <CornerDownLeft
                      size={14}
                      className={
                        index === safeActive ? "text-slate-500 dark:text-slate-400" : "invisible"
                      }
                    />
                  </button>
                );
              })}
            </>
          )}

          {mode === "hint" && (
            <p className="px-3 py-4 text-sm text-slate-600 dark:text-slate-300">
              Digite pelo menos {SEARCH_MIN_CHARS} caracteres para buscar.
            </p>
          )}

          {mode === "loading" && (
            <p className="flex items-center gap-2 px-3 py-4 text-sm text-slate-600 dark:text-slate-300">
              <Loader2 size={14} className="animate-spin" />
              Buscando...
            </p>
          )}

          {mode === "error" && (
            <p className="px-3 py-4 text-sm text-red-600 dark:text-red-400">
              Não foi possível concluir a busca. Tente novamente.
            </p>
          )}

          {mode === "empty" && (
            <p className="px-3 py-4 text-sm text-slate-600 dark:text-slate-300">
              Nenhum resultado encontrado para &apos;{term}&apos;
            </p>
          )}

          {mode === "results" &&
            groups.map((group) => (
              <div key={group.kind}>
                <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {group.kind === "paciente"
                    ? "Pacientes"
                    : group.kind === "medico"
                      ? "Profissionais"
                      : group.kind === "consulta"
                        ? "Consultas"
                        : "Especialidades"}
                </p>
                {group.items.map((hit, offset) => {
                  const index = group.start + offset;
                  const Icon = KIND_ICON[hit.kind];
                  const selected = index === safeActive;
                  return (
                    <button
                      key={`${hit.kind}-${hit.id}`}
                      id={`global-search-option-${index}`}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onMouseEnter={() => setActive(index)}
                      onClick={() => choose(hit.href)}
                      className={optionClass(selected)}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
                        <Icon size={16} strokeWidth={1.75} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-900 dark:text-white">
                          {hit.title}
                        </span>
                        <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                          {hit.description}
                        </span>
                      </span>
                      <CornerDownLeft
                        size={14}
                        className={selected ? "text-slate-500 dark:text-slate-400" : "invisible"}
                      />
                    </button>
                  );
                })}
              </div>
            ))}

          <div
            className="mt-1 flex items-center justify-between border-t px-3 py-2 text-[11px] text-slate-500 dark:text-slate-400"
            style={{ borderColor: "var(--surface-border)" }}
          >
            <span className="flex items-center gap-1">
              <ArrowUp size={12} />
              <ArrowDown size={12} />
              navegar
            </span>
            <span className="flex items-center gap-1">
              <CornerDownLeft size={12} />
              abrir
            </span>
            <span>esc fechar</span>
          </div>
        </div>
      )}
    </div>
  );
}
