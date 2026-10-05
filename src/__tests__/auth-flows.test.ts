import { describe, it, expect, vi, beforeEach } from "vitest";

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key-de-teste";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key-de-teste";
});

const auth = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
}));

type QueryResult<T> = { data: T; error: { message: string } | null };
type DbOp = {
  table: string;
  op: "insert" | "delete" | "eq" | "single";
  values?: unknown;
  col?: string;
  val?: unknown;
};

interface DbState {
  adminProfile: QueryResult<{ role: string; legacy_username: string | null } | null>;
  clinics: QueryResult<{ clinic_id: number }[]>;
  clinicInserted: QueryResult<{ id: number } | null>;
  failInsertOn: string | null;
  ops: DbOp[];
  deletedUsers: string[];
  reset(): void;
}

const db = vi.hoisted((): DbState => ({
  adminProfile: { data: { role: "admin", legacy_username: "admin" }, error: null },
  clinics: { data: [{ clinic_id: 1 }], error: null },
  clinicInserted: { data: { id: 42 }, error: null },
  failInsertOn: null,
  ops: [],
  deletedUsers: [],
  reset() {
    db.adminProfile = { data: { role: "admin", legacy_username: "admin" }, error: null };
    db.clinics = { data: [{ clinic_id: 1 }], error: null };
    db.clinicInserted = { data: { id: 42 }, error: null };
    db.failInsertOn = null;
    db.ops = [];
    db.deletedUsers = [];
  },
}));

function serviceBuilder(table: string) {
  const b: Record<string, unknown> = {};
  const result = async () => {
    if (table === "admin_profiles") return db.adminProfile;
    if (table === "clinic_members") return { data: db.clinics.data, error: db.clinics.error };
    return { data: [], error: null };
  };
  b.select = () => b;
  b.eq = () => b;
  b.maybeSingle = () => result();
  b.then = (onOk: (v: unknown) => unknown, onErr?: (e: unknown) => unknown) =>
    Promise.resolve(result()).then(onOk, onErr);
  return b;
}

function adminBuilder(table: string) {
  const b: Record<string, unknown> = {};
  let op: "insert" | "delete" | null = null;
  const failure = () => (db.failInsertOn === table ? { message: `falha em ${table}` } : null);
  b.insert = (values: unknown) => {
    op = "insert";
    db.ops.push({ table, op: "insert", values });
    return b;
  };
  b.delete = () => {
    op = "delete";
    db.ops.push({ table, op: "delete" });
    return b;
  };
  b.eq = (col: string, val: unknown) => {
    const last = db.ops[db.ops.length - 1];
    if (last && last.table === table && last.op === "delete") {
      last.col = col;
      last.val = val;
    } else {
      db.ops.push({ table, op: op ?? "eq", col, val });
    }
    return b;
  };
  b.select = () => b;
  b.single = () => {
    db.ops.push({ table, op: "single" });
    return Promise.resolve(failure() ? { data: null, error: { message: failure()!.message } } : db.clinicInserted);
  };
  b.then = (onOk: (v: unknown) => unknown, onErr?: (e: unknown) => unknown) =>
    Promise.resolve({ data: null, error: failure() }).then(onOk, onErr);
  return b;
}

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: { signInWithPassword: auth.signInWithPassword, signUp: auth.signUp },
  })),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ from: serviceBuilder })),
}));

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: adminBuilder,
    auth: {
      admin: {
        deleteUser: vi.fn(async (id: string) => {
          db.deletedUsers.push(id);
          return { error: null };
        }),
      },
    },
  },
}));

import { NextRequest } from "next/server";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as signup } from "@/app/api/auth/signup/route";

function jsonRequest(path: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/login (Fase 5.3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.reset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("400 quando email ou senha faltam", async () => {
    const res = await login(jsonRequest("/api/auth/login", { email: "", password: "" }));
    expect(res.status).toBe(400);
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("401 quando o GoTrue rejeita as credenciais", async () => {
    auth.signInWithPassword.mockResolvedValueOnce({
      data: { user: null },
      error: { message: "Invalid login credentials", code: "invalid_credentials", status: 400 },
    });

    const res = await login(jsonRequest("/api/auth/login", { email: "a@b.com", password: "x" }));

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe("invalid_credentials");
    expect(console.error).toHaveBeenCalled();
  });

  it("403 PROFILE_MISSING quando não há linha em admin_profiles", async () => {
    auth.signInWithPassword.mockResolvedValueOnce({ data: { user: { id: "u1", email: "a@b.com" } }, error: null });
    db.adminProfile = { data: null, error: null };

    const res = await login(jsonRequest("/api/auth/login", { email: "a@b.com", password: "x" }));

    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("PROFILE_MISSING");
  });

  it("403 CLINIC_MISSING quando o admin não está vinculado a nenhuma clínica", async () => {
    auth.signInWithPassword.mockResolvedValueOnce({ data: { user: { id: "u1", email: "a@b.com" } }, error: null });
    db.clinics = { data: [], error: null };

    const res = await login(jsonRequest("/api/auth/login", { email: "a@b.com", password: "x" }));

    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("CLINIC_MISSING");
  });

  it("200 sem clínica para papel de plataforma (super_admin)", async () => {
    auth.signInWithPassword.mockResolvedValueOnce({ data: { user: { id: "u1", email: "a@b.com" } }, error: null });
    db.adminProfile = { data: { role: "super_admin", legacy_username: null }, error: null };
    db.clinics = { data: [], error: null };

    const res = await login(jsonRequest("/api/auth/login", { email: "a@b.com", password: "x" }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.role).toBe("super_admin");
    expect(body.user.clinicIds).toEqual([]);
  });

  it("200 no caminho feliz: normaliza o email, devolve papel e clínicas", async () => {
    auth.signInWithPassword.mockResolvedValueOnce({ data: { user: { id: "u1", email: "a@b.com" } }, error: null });

    const res = await login(jsonRequest("/api/auth/login", { email: "  Admin@Clinica.COM ", password: "segredo" }));

    expect(res.status).toBe(200);
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: "admin@clinica.com", password: "segredo" });
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, user: { id: "u1", role: "admin", clinicIds: ["1"] } });
  });
});

describe("POST /api/auth/signup (Fase 5.3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.reset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("400 quando falta nome, email ou senha", async () => {
    const res = await signup(jsonRequest("/api/auth/signup", { email: "a@b.com", password: "12345678" }));
    expect(res.status).toBe(400);
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it("400 quando a senha tem menos de 8 caracteres", async () => {
    const res = await signup(
      jsonRequest("/api/auth/signup", { name: "Ana", email: "a@b.com", password: "curta" })
    );
    expect(res.status).toBe(400);
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it("409 quando o e-mail já está cadastrado (identities vazio)", async () => {
    auth.signUp.mockResolvedValueOnce({ data: { user: { id: "u1", identities: [] } }, error: null });

    const res = await signup(
      jsonRequest("/api/auth/signup", { name: "Ana", email: "a@b.com", password: "12345678" })
    );

    expect(res.status).toBe(409);
    expect(db.ops.filter((o) => o.op === "insert")).toHaveLength(0);
  });

  it("201 cria profiles → admin_profiles → clinics → clinic_members na ordem", async () => {
    auth.signUp.mockResolvedValueOnce({
      data: { user: { id: "u1", identities: [{ id: "local" }] } },
      error: null,
    });

    const res = await signup(
      jsonRequest("/api/auth/signup", { name: "Ana", email: "a@b.com", password: "12345678", clinicName: "Clínica Central" })
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, userId: "u1", clinicId: 42 });

    // audit_logs (Fase 6.3) tambem insere; a ordem das tabelas do tenant
    // e o que este teste garante.
    const inserts = db.ops.filter((o) => o.op === "insert" && o.table !== "audit_logs");
    expect(inserts.map((o) => o.table)).toEqual(["profiles", "admin_profiles", "clinics", "clinic_members"]);
    expect(inserts[2].values).toMatchObject({ name: "Clínica Central" });
    expect(inserts[3].values).toMatchObject({ clinic_id: 42, user_id: "u1", role: "owner", active: true });
    expect(db.deletedUsers).toHaveLength(0);
  });

  it("falha em clinic_members reverte tudo em ordem inversa e apaga o usuário", async () => {
    auth.signUp.mockResolvedValueOnce({
      data: { user: { id: "u1", identities: [{ id: "local" }] } },
      error: null,
    });
    db.failInsertOn = "clinic_members";

    const res = await signup(
      jsonRequest("/api/auth/signup", { name: "Ana", email: "a@b.com", password: "12345678" })
    );

    expect(res.status).toBe(500);

    const deletes = db.ops.filter((o) => o.op === "delete");
    expect(deletes.map((o) => o.table)).toEqual(["clinic_members", "clinics", "admin_profiles", "profiles"]);
    expect(deletes[1]).toMatchObject({ table: "clinics", col: "id", val: 42 });
    expect(db.deletedUsers).toEqual(["u1"]);
    expect(console.error).toHaveBeenCalled();
  });
});
