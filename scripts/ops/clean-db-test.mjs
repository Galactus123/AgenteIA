#!/usr/bin/env node
// ============================================================
// Fase 2.5 - cadeia de migrations em banco LIMPO (Docker)
// ============================================================
// Sobe um Postgres 16 descartavel, aplica o bootstrap (roles
// anon/authenticated/service_role + schema auth + default
// privileges, como no Supabase) e roda TODAS as migrations de
// supabase/migrations/ em ordem, com ON_ERROR_STOP=1. Depois
// roda a verificacao (clean-db-verify.sql) e os testes de papel
// (anon negado, authenticated 0 linhas via RLS, service_role
// bypass).
//
// Uso:
//   node scripts/ops/clean-db-test.mjs           # roda e destroi
//   node scripts/ops/clean-db-test.mjs --keep    # mantem o container
//
// Requisitos: Docker rodando + imagem postgres:16 (baixada se faltar).
// Saida: console + scripts/ops/clean-db-run.log
// Exit code: 0 = cadeia integra; 1 = falha (container fica de pe).
// ============================================================

import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const MIGRATIONS_DIR = path.join(ROOT, "supabase", "migrations");
const BOOTSTRAP = path.join(HERE, "clean-db-bootstrap.sql");
const VERIFY = path.join(HERE, "clean-db-verify.sql");
const LOG_FILE = path.join(HERE, "clean-db-run.log");

const IMAGE = "postgres:16";
const CONTAINER = "saudesync-migtest";
const DB = "saudesync";
const USER = "postgres";
const KEEP = process.argv.includes("--keep");

const logLines = [];
const startedAt = new Date();

function log(line = "") {
  logLines.push(line);
  console.log(line);
}

function docker(args, opts = {}) {
  return spawnSync("docker", args, { encoding: "utf8", ...opts });
}

function psql(content, label) {
  const res = docker(
    ["exec", "-i", CONTAINER, "psql", "-U", USER, "-d", DB, "-v", "ON_ERROR_STOP=1", "-q", "-f", "-"],
    { input: content }
  );
  const out = `${res.stdout || ""}${res.stderr || ""}`.trim();
  if (out) log(out);
  if (res.status !== 0) {
    log(`FALHA em ${label} (exit ${res.status})`);
    return { ok: false, status: res.status, out };
  }
  return { ok: true, status: 0, out };
}

function psqlRaw(content) {
  const res = docker(
    ["exec", "-i", CONTAINER, "psql", "-U", USER, "-d", DB, "-v", "ON_ERROR_STOP=1", "-q", "-f", "-"],
    { input: content }
  );
  return { status: res.status, out: `${res.stdout || ""}${res.stderr || ""}` };
}

function die(msg) {
  log("");
  log(`ERRO: ${msg}`);
  finish(1);
}

function finish(code) {
  log("");
  log(`--- Fim: ${new Date().toISOString()} (inicio ${startedAt.toISOString()}) ---`);
  writeFileSync(LOG_FILE, logLines.join("\n") + "\n", "utf8");
  console.log(`Log gravado em ${path.relative(ROOT, LOG_FILE)}`);
  process.exit(code);
}

// ── 1. Pre-requisitos ────────────────────────────────────────
log(`=== clean-db-test (Fase 2.5) — ${startedAt.toISOString()} ===`);

const version = docker(["version", "--format", "{{.Server.Version}}"]);
if (version.status !== 0) {
  die(`Docker indisponivel: ${(version.stderr || "").trim()}`);
}
log(`Docker OK (engine ${version.stdout.trim()})`);

if (docker(["image", "inspect", IMAGE]).status !== 0) {
  log(`Baixando imagem ${IMAGE}...`);
  const pull = docker(["pull", IMAGE], { stdio: "inherit" });
  if (pull.status !== 0) die(`falha ao baixar ${IMAGE}`);
}

// ── 2. Container descartavel ─────────────────────────────────
docker(["rm", "-f", CONTAINER]);
const run = docker([
  "run", "-d", "--name", CONTAINER,
  "-e", "POSTGRES_PASSWORD=postgres",
  "-e", "POSTGRES_DB=" + DB,
  "-e", "POSTGRES_HOST_AUTH_METHOD=trust",
  IMAGE,
]);
if (run.status !== 0) die(`docker run falhou: ${(run.stderr || "").trim()}`);
log(`Container ${CONTAINER} (${IMAGE}) iniciado`);

let ready = false;
for (let i = 0; i < 60; i++) {
  if (docker(["exec", CONTAINER, "psql", "-U", USER, "-d", DB, "-tAc", "SELECT 1"]).status === 0) {
    ready = true;
    break;
  }
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000); // pausa ~1s
}
if (!ready) die("Postgres nao ficou pronto em 60s");log("Postgres pronto");

// ── 3. Bootstrap (roles + auth + default privileges) ─────────
log("");
log("--- Bootstrap ---");
const bootstrap = psql(readFileSync(BOOTSTRAP, "utf8"), "bootstrap");
if (!bootstrap.ok) finish(1);

// ── 4. Migrations em ordem ───────────────────────────────────
const files = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql") && !f.endsWith(".backup.sql"))
  .sort();
if (files.length === 0) die("nenhuma migration encontrada em supabase/migrations/");

log("");
log(`--- Migrations (${files.length}) ---`);
let failed = null;
for (const file of files) {
  const t0 = Date.now();
  log(`> ${file}`);
  const res = psql(readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"), file);
  const ms = Date.now() - t0;
  if (!res.ok) {
    log(`  FALHOU em ${ms}ms`);
    failed = file;
    break;
  }
  log(`  ok (${ms}ms)`);
}
if (failed) {
  log("");
  log(`Cadeia interrompida na migration: ${failed}`);
  log(`Container mantido para inspecao: docker exec -it ${CONTAINER} psql -U ${USER} -d ${DB}`);
  log(`Remover: docker rm -f ${CONTAINER}`);
  finish(1);
}

// ── 5. Verificacao (CHECKs) ──────────────────────────────────
log("");
log("--- Verificacao (clean-db-verify.sql) ---");
const verify = psql(readFileSync(VERIFY, "utf8"), "verificacao");
if (!verify.ok) {
  log("Container mantido para inspecao.");
  finish(1);
}

// ── 6. Testes de papel ──────────────────────────────────────
log("");
log("--- Testes de papel ---");

const anon = psqlRaw("SET ROLE anon;\nSELECT count(*) FROM clinics;\n");
if (anon.status === 0 || !/permission denied/.test(anon.out)) {
  log(`FALHA: anon deveria receber "permission denied" em clinics. out=${anon.out.trim()}`);
  finish(1);
}
log("ok: anon NEGADO em clinics (permission denied)");

const auth = psqlRaw(
  "SET ROLE authenticated;\n" +
    "SELECT count(*) FROM clinics;\n" +
    "SELECT count(*) FROM patients;\n" +
    "SELECT count(*) FROM admin_profiles;\n"
);
if (auth.status !== 0) {
  log(`FALHA: authenticated deveria conseguir SELECT (RLS zera linhas). out=${auth.out.trim()}`);
  finish(1);
}
const zeros = (auth.out.match(/^-?\s*0\s*$/gm) || []).length;
if (zeros < 3) {
  log(`FALHA: authenticated deveria ver 0 linhas em 3 tabelas. out=${auth.out.trim()}`);
  finish(1);
}
log("ok: authenticated = 0 linhas em clinics/patients/admin_profiles (RLS)");

const svc = psqlRaw("SET ROLE service_role;\nSELECT count(*) FROM clinics;\n");
if (svc.status !== 0 || !/^\s*1\s*$/m.test(svc.out)) {
  log(`FALHA: service_role deveria ver a clinica seed (bypass RLS). out=${svc.out.trim()}`);
  finish(1);
}
log("ok: service_role BYPASSRLS (1 clinica seed visivel)");

// ── 7. Resumo ────────────────────────────────────────────────
log("");
log("=== RESULTADO: CADEIA INTEGR — banco limpo validado (Fase 2.5) ===");
log(`Migrations executadas: ${files.length}`);
log(`Tabelas/log acima; ver CHECKs e inventario em clean-db-verify.sql.`);

if (!KEEP) {
  docker(["stop", CONTAINER]);
  log(`Container ${CONTAINER} removido (--rm). Use --keep para manter.`);
} else {
  log(`Container ${CONTAINER} mantido (--keep). Remover: docker rm -f ${CONTAINER}`);
}
finish(0);
