// Harness compartilhado dos testes de services (Fase 8.3): cadeia
// thenable que registra cada consulta feita pelo supabaseAdmin e delega
// o resultado a um resolver definido por teste. Segue o padrao ja usado
// em stats.test.ts, generalizado para insert/update/delete/upsert e os
// demais filtros usados pelos services.
//
// Uso no teste:
//   vi.mock("@/lib/supabase", async () => {
//     const { fakeSupabase } = await import("./helpers/supabase-fake");
//     return { supabaseAdmin: fakeSupabase.admin };
//   });
//   fakeSupabase.setResolver((q) => { ... });

export interface FakeQuery {
  table: string;
  op: "select" | "insert" | "update" | "delete" | "upsert" | "rpc";
  columns: string;
  payload: Record<string, unknown> | Record<string, unknown>[] | null;
  filters: string[];
  opts: Record<string, unknown>;
}

export interface FakeResult {
  data?: unknown;
  error?: { message: string; code?: string } | null;
  count?: number | null;
}

export type FakeResolver = (q: FakeQuery) => FakeResult | void;

const queries: FakeQuery[] = [];
let resolver: FakeResolver = () => undefined;

function resolveQuery(q: FakeQuery): FakeResult {
  queries.push(q);
  const custom = resolver(q);
  if (custom !== undefined) return custom;
  const wantsRow = Boolean(q.opts.single || q.opts.maybeSingle);
  return { data: wantsRow ? null : [], count: 0, error: null };
}

function createAdmin(): {
  from: (table: string) => unknown;
  rpc: (fn: string, params?: Record<string, unknown>) => Promise<FakeResult>;
} {
  const admin = {
    from(table: string) {
      const q: FakeQuery = {
        table,
        op: "select",
        columns: "",
        payload: null,
        filters: [],
        opts: {},
      };
      const b: Record<string, unknown> = {};

      b.select = (columns?: string, opts?: { head?: boolean; count?: string }) => {
        q.columns = columns ?? "";
        if (opts?.head) q.opts.head = true;
        if (opts?.count) q.opts.count = opts.count;
        return b;
      };
      b.insert = (payload: Record<string, unknown>) => {
        q.op = "insert";
        q.payload = payload;
        return b;
      };
      b.upsert = (payload: Record<string, unknown>, opts?: Record<string, unknown>) => {
        q.op = "upsert";
        q.payload = payload;
        if (opts) q.opts = { ...q.opts, ...opts };
        return b;
      };
      b.update = (payload: Record<string, unknown>) => {
        q.op = "update";
        q.payload = payload;
        return b;
      };
      b.delete = () => {
        q.op = "delete";
        return b;
      };
      b.eq = (col: string, val: unknown) => {
        q.filters.push(`${col}=${String(val)}`);
        return b;
      };
      b.neq = (col: string, val: unknown) => {
        q.filters.push(`${col}!=${String(val)}`);
        return b;
      };
      b.gt = (col: string, val: unknown) => {
        q.filters.push(`${col}>${String(val)}`);
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
      b.lte = (col: string, val: unknown) => {
        q.filters.push(`${col}<=${String(val)}`);
        return b;
      };
      b.in = (col: string, vals: unknown[]) => {
        q.filters.push(`${col} in [${vals.join("|")}]`);
        return b;
      };
      b.or = (expr: string) => {
        q.filters.push(`or(${expr})`);
        return b;
      };
      b.order = (col: string, opts?: { ascending?: boolean }) => {
        q.filters.push(`order:${col}${opts?.ascending === false ? ":desc" : ""}`);
        return b;
      };
      b.limit = (n: number) => {
        q.filters.push(`limit:${n}`);
        return b;
      };
      b.single = () => {
        q.opts.single = true;
        return b;
      };
      b.maybeSingle = () => {
        q.opts.maybeSingle = true;
        return b;
      };
      b.then = (
        onOk: (value: FakeResult) => unknown,
        onErr?: (reason: unknown) => unknown
      ) => Promise.resolve(resolveQuery(q)).then(onOk, onErr);

      return b;
    },
    // supabaseAdmin.rpc("fn", params): regista a funcao em `table` e os
    // argumentos em `payload`. O default devolve data [], que os services
    // tratam como "RPC indisponivel" e caem no caminho legado
    // (read-modify-write) - para exercitar o caminho atomico o resolver
    // devolve { data: ... }.
    rpc(fn: string, params?: Record<string, unknown>) {
      const q: FakeQuery = {
        table: fn,
        op: "rpc",
        columns: "",
        payload: params ?? null,
        filters: [],
        opts: {},
      };
      return Promise.resolve(resolveQuery(q));
    },
  };
  return admin;
}

export const fakeSupabase = {
  admin: createAdmin(),
  get queries(): FakeQuery[] {
    return queries;
  },
  setResolver(fn: FakeResolver): void {
    resolver = fn;
  },
  reset(): void {
    queries.length = 0;
    resolver = () => undefined;
  },
  find(table: string, op?: FakeQuery["op"]): FakeQuery[] {
    return queries.filter((q) => q.table === table && (!op || q.op === op));
  },
  last(table: string, op?: FakeQuery["op"]): FakeQuery | undefined {
    const list = fakeSupabase.find(table, op);
    return list[list.length - 1];
  },
};
