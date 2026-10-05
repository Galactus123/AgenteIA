import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock do SupabaseAdmin: cadeia thenable que registra cada consulta e delega
// a um resolver definido por teste (Fase 4.1/4.3 - leitura de métricas).
const h = vi.hoisted(() => {
  type Result = {
    count?: number | null;
    data?: Record<string, unknown>[] | null;
    error?: { message: string } | null;
  };
  type Query = { table: string; filters: string[]; head: boolean; columns: string };

  const queries: Query[] = [];
  const empty: Result = { count: 0, data: [], error: null };
  let resolver: (q: Query) => Result = () => empty;

  function createAdmin() {
    return {
      from(table: string) {
        const q: Query = { table, filters: [], head: false, columns: "" };
        const b: Record<string, unknown> = {};
        b.select = (columns: string, opts?: { head?: boolean }) => {
          q.columns = columns;
          q.head = Boolean(opts?.head);
          return b;
        };
        b.eq = (col: string, val: unknown) => {
          q.filters.push(`${col}=${String(val)}`);
          return b;
        };
        b.gte = (col: string, val: unknown) => {
          q.filters.push(`${col}>=${String(val)}`);
          return b;
        };
        b.lt = (col: string, val: unknown) => {
          q.filters.push(`${col}<${String(val)}`);
          return b;
        };
        b.in = (col: string, vals: string[]) => {
          q.filters.push(`${col} in [${vals.join("|")}]`);
          return b;
        };
        b.order = (col: string) => {
          q.filters.push(`order:${col}`);
          return b;
        };
        b.limit = (n: number) => {
          q.filters.push(`limit:${n}`);
          return b;
        };
        b.then = (
          onOk: (value: Result) => unknown,
          onErr?: (reason: unknown) => unknown
        ) => {
          queries.push(q);
          return Promise.resolve(resolver(q)).then(onOk, onErr);
        };
        return b;
      },
    };
  }

  return {
    queries,
    createAdmin,
    setResolver(fn: (q: Query) => Result) {
      resolver = fn;
    },
    reset() {
      queries.length = 0;
      resolver = () => empty;
    },
  };
});

vi.mock("@/lib/supabase", () => ({ supabaseAdmin: h.createAdmin() }));

import { getStats } from "@/lib/services/stats";
import { todayStr, addDays } from "@/lib/datetime";

describe("getStats (Fase 4)", () => {
  beforeEach(() => h.reset());

  it("totalPatients lê a tabela patients e a agenda de hoje filtra por data (4.1)", async () => {
    h.setResolver((q) => {
      if (q.head && q.table === "patients") return { count: 7 };
      if (q.head && q.table === "appointments") {
        const today = q.filters.some((f) => f.startsWith("starts_at>="));
        return { count: q.filters.includes("status=scheduled") && today ? 3 : 40 };
      }
      return { count: 0, data: [], error: null };
    });

    const stats = await getStats();
    const today = todayStr();
    const tomorrow = addDays(today, 1);

    expect(stats.totalPatients).toBe(7);
    expect(stats.todayScheduled).toBe(3);
    expect(stats.errors).toEqual([]);

    const todayScheduled = h.queries.find(
      (q) => q.table === "appointments" && q.head && q.filters.includes("status=scheduled") && q.filters.includes(`starts_at>=${today} 00:00`)
    );
    expect(todayScheduled?.filters).toContain(`starts_at<${tomorrow} 00:00`);
  });

  it("pendingRequests lê conversas aguardando o humano (4.2)", async () => {
    h.setResolver((q) => {
      if (q.table === "conversations" && q.filters.some((f) => f.startsWith("status in"))) {
        return {
          data: [
            {
              id: 9,
              phone: "+258 84 000 0000",
              patient_name: "Maria Silva",
              status: "transferred",
              updated_at: "2026-10-05T10:00:00+00:00",
            },
            {
              id: 10,
              phone: "+258 84 000 0001",
              patient_name: "",
              status: "WAITING_HUMAN_INTERVENTION",
              updated_at: "2026-10-04T09:00:00+00:00",
            },
          ],
        };
      }
      return { count: 12, data: [], error: null };
    });

    const stats = await getStats();

    expect(stats.pendingRequests).toEqual([
      {
        id: 9,
        patient_name: "Maria Silva",
        patient_phone: "+258 84 000 0000",
        status: "transferred",
        updated_at: "2026-10-05T10:00:00+00:00",
      },
      {
        id: 10,
        patient_name: "",
        patient_phone: "+258 84 000 0001",
        status: "WAITING_HUMAN_INTERVENTION",
        updated_at: "2026-10-04T09:00:00+00:00",
      },
    ]);

    const pendingQuery = h.queries.find(
      (q) => q.table === "conversations" && q.filters.some((f) => f.startsWith("status in"))
    );
    expect(pendingQuery?.filters.join(" ")).toContain("transferred");
    expect(pendingQuery?.filters.join(" ")).toContain("WAITING_HUMAN_INTERVENTION");
    expect(pendingQuery?.filters).toContain("order:updated_at");
    expect(pendingQuery?.filters).toContain("limit:5");
    expect(stats.errors).toEqual([]);
  });

  it("falha de banco vira erro reportado, não zero silencioso (4.3)", async () => {
    h.setResolver((q) => {
      if (q.table === "patients") return { error: { message: "connection refused" } };
      if (q.table === "conversations" && q.filters.some((f) => f.startsWith("status in"))) {
        return { error: { message: "timeout" } };
      }
      return { count: 5, data: [], error: null };
    });

    const stats = await getStats();

    expect(stats.totalPatients).toBe(0);
    expect(stats.pendingRequests).toEqual([]);
    expect(stats.errors).toContain("pacientes");
    expect(stats.errors).toContain("conversas aguardando humano");
    expect(new Set(stats.errors).size).toBe(stats.errors.length);
  });
});
