#!/usr/bin/env node
// ============================================================
// Fase 7.1 - smoke test (somente leitura + 1 login invalido)
// ============================================================
// Confere que a aplicacao BUILDADA responde o essencial:
//   * /api/health 200 com ping real do banco (Fase 8.2: checks.database=ok)
//     (sem ping = 503 {status:"degraded"} → aqui vira FAIL)
//   * paginas publicas 200 (/login, /precos, /privacidade, /)
//   * /dashboard sem sessao -> redirect 307/308 para /login (proxy)
//   * APIs protegidas sem sessao -> 401 (nunca redirect)
//   * POST /api/auth/login com credenciais invalidas -> 401
//
// Uso:
//   node scripts/ops/smoke-test.mjs                      # PUBLIC_URL do .env (deploy)
//   node scripts/ops/smoke-test.mjs --url http://localhost:3000   # build local
//   node scripts/ops/smoke-test.mjs --skip-login         # nao toca em /auth/login
//
// NAO escreve em banco (a rota de login usada e a de credenciais
// invalidas, que falha antes de qualquer efeito colateral).
// Exit: 0 = todos os checks passaram.
// ============================================================

import { loadRootEnv } from "./env.mjs";

const args = process.argv.slice(2);
const urlIdx = args.indexOf("--url");
const BASE = (urlIdx >= 0 ? args[urlIdx + 1] : loadRootEnv().PUBLIC_URL ?? "http://localhost:3000").replace(/\/+$/, "");
const SKIP_LOGIN = args.includes("--skip-login");

const results = [];

async function check(name, fn) {
  try {
    const r = await fn();
    const ok = r.ok === true;
    results.push({ name, ok, detail: r.detail ?? "" });
    console.log(`${ok ? "ok  " : "FAIL"}  ${name}${r.detail ? `  — ${r.detail}` : ""}`);
  } catch (err) {
    results.push({ name, ok: false, detail: String(err.message ?? err) });
    console.log(`FAIL  ${name}  — ${err.message ?? err}`);
  }
}

const status = async (path, init) => {
  const res = await fetch(`${BASE}${path}`, { redirect: "manual", ...init });
  return res;
};

console.log(`=== smoke test (Fase 7.1) — ${BASE} ===\n`);

// 1. Health (Fase 8.2: 200 so vale com o ping do banco ok)
await check("GET /api/health = 200 {status:ok, checks.database:ok}", async () => {
  const res = await status("/api/health");
  const body = await res.json().catch(() => ({}));
  const db = body.checks?.database;
  return {
    ok: res.status === 200 && body.status === "ok" && db === "ok",
    detail: `HTTP ${res.status}, db=${db ?? "(sem checks)"}`,
  };
});

// 2. Paginas publicas
await check("GET / -> redirect p/ /login (raiz = login)", async () => {
  const res = await status("/");
  const loc = res.headers.get("location") ?? "";
  return {
    ok: res.status >= 300 && res.status < 400 && loc.includes("/login"),
    detail: `HTTP ${res.status} -> ${loc || "(sem location)"}`,
  };
});
for (const path of ["/login", "/precos", "/privacidade", "/termos"]) {
  await check(`GET ${path} = 200`, async () => {
    const res = await status(path);
    return { ok: res.status === 200, detail: `HTTP ${res.status}` };
  });
}

// 3. Proxy: pagina protegida sem sessao redireciona
for (const path of ["/dashboard", "/configuracoes/auditoria"]) {
  await check(`GET ${path} sem sessao -> redirect p/ /login`, async () => {
    const res = await status(path);
    const loc = res.headers.get("location") ?? "";
    const isRedirect = res.status >= 300 && res.status < 400;
    const toLogin = loc.includes("/login");
    return { ok: isRedirect && toLogin, detail: `HTTP ${res.status} -> ${loc || "(sem location)"}` };
  });
}

// 4. APIs protegidas: 401, nunca redirect
for (const path of [
  "/api/appointments",
  "/api/stats",
  "/api/audit",
  "/api/pacientes",
]) {
  await check(`GET ${path} sem sessao = 401`, async () => {
    const res = await status(path);
    return { ok: res.status === 401, detail: `HTTP ${res.status}` };
  });
}

// 4b. /api/auth/me e honesta: 200 com {authenticated:false}, nunca 500
await check("GET /api/auth/me sem sessao = 200 {authenticated:false}", async () => {
  const res = await status("/api/auth/me");
  const body = await res.json().catch(() => ({}));
  return { ok: res.status === 200 && body.authenticated === false, detail: `HTTP ${res.status}` };
});

// 5. Rotas internas fechadas sem token (Fase 6.2: sem bypass)
await check("GET /api/reminders/run sem token != 200", async () => {
  const res = await status("/api/reminders/run");
  return { ok: res.status === 401 || res.status === 500, detail: `HTTP ${res.status}` };
});

// 6. Login invalido (falha antes de qualquer escrita)
if (!SKIP_LOGIN) {
  await check("POST /api/auth/login credenciais invalidas = 401", async () => {
    const res = await status("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "smoke-test@invalido.local", password: "senha-invalida-123" }),
    });
    return { ok: res.status === 401, detail: `HTTP ${res.status}` };
  });
}

const failed = results.filter((r) => !r.ok);
console.log("");
console.log(
  failed.length === 0
    ? `=== SMOKE OK — ${results.length}/${results.length} checks ===`
    : `=== SMOKE FALHOU — ${failed.length} de ${results.length} checks ===`
);

console.log(`
Pendencias MANUAIS do go-live (nao cobertas pelo smoke):
  [ ] migrations aplicadas no SQL Editor (20 — as 5 pendentes estao no script
      scripts/ops/pending-migrations.sql; sem as de grants audit_logs/outbox dao 42501)
  [ ] seed: node scripts/setup-supabase.mjs
  [ ] env vars da Vercel completas (OPENAI_API_KEY, KOMUNIKA_*, LOJOU_*, CRON_SECRET, INTERNAL_API_TOKEN)
  [ ] Vault/pg_cron: scripts/ops/setup-cron-secrets.sql + SELECT jobname FROM cron.job;
  [ ] branch protection exige o status check "quality"
  [ ] rotacao das 5 chaves expostas (token Komunika atual responde 401)`);

process.exit(failed.length === 0 ? 0 : 1);
