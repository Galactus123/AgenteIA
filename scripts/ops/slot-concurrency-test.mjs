#!/usr/bin/env node
// ============================================================
// Fase 7.4 - teste de CONCORRENCIA de slot (Docker)
// ============================================================
// Prova que dois agendamentos simultaneos para o mesmo
// (professional_id, starts_at) nao viram double booking:
// o indice parcial
//   uq_appointments_professional_start
//   ON appointments (professional_id, starts_at)
//   WHERE status = 'scheduled' AND professional_id IS NOT NULL
// faz o Postgres rejeitar a segunda insercao com SQLSTATE 23505,
// mesmo quando as duas corridam de verdade (sessoes concorrentes).
//
// Roteiro:
//   1. Postgres 16 descartavel + bootstrap + TODAS as migrations
//   2. seed minimo (especialidade + profissional)
//   3. 2 insercoes concorrentes  -> exatamente 1 vence
//   4. 5 insercoes concorrentes  -> exatamente 1 vence
//   5. status != 'scheduled' x2  -> permitido (indice e parcial)
//
// Uso:
//   node scripts/ops/slot-concurrency-test.mjs
// Requisitos: Docker + imagem postgres:16.
// Exit: 0 = so um vence em todas as rodadas; 1 = falha.
// ============================================================

import { spawn, spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const MIGRATIONS_DIR = path.join(ROOT, "supabase", "migrations");
const BOOTSTRAP = path.join(HERE, "clean-db-bootstrap.sql");

const IMAGE = "postgres:16";
const CONTAINER = "saudesync-slotrace";
const DB = "saudesync";
const USER = "postgres";
const SLOT = "2030-01-15 09:00:00";
const SLOT2 = "2030-01-15 10:00:00";

const startedAt = new Date();
const log = (line = "") => console.log(line);

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
    return false;
  }
  return true;
}

function psqlExec(sql) {
  // Sessao "solta": nao aborta o script no erro — queremos VER o 23505.
  return new Promise((resolve) => {
    const child = spawn(
      "docker",
      ["exec", "-i", CONTAINER, "psql", "-U", USER, "-d", DB, "-q", "-c", sql],
      { encoding: "utf8" }
    );
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("close", (code) => resolve({ code, out: out.trim() }));
  });
}

function finish(code, containerAlive) {
  log("");
  log(`--- Fim: ${new Date().toISOString()} (inicio ${startedAt.toISOString()}) ---`);
  if (containerAlive) {
    docker(["rm", "-f", CONTAINER]);
    log("Container removido.");
  }
  process.exit(code);
}

function die(msg) {
  log("");
  log(`ERRO: ${msg}`);
  finish(1, true);
}

function insertAppointment(patient, slot) {
  return `
INSERT INTO appointments
  (patient_name, patient_phone, specialty_id, professional_id,
   starts_at, ends_at, status, source, created_at, updated_at)
SELECT '${patient}', '+258847000000', s.id, p.id,
       '${slot}', '${slot}', 'scheduled', 'teste_concorrencia',
       now(), now()
FROM specialties s, professionals p
WHERE s.name = 'Cardiologia Teste' AND p.name = 'Dr. Concorrencia'
LIMIT 1;`;
}

log(`=== slot-concurrency-test (Fase 7.4) — ${startedAt.toISOString()} ===`);

// ── 1. Pre-requisitos ────────────────────────────────────────
const version = docker(["version", "--format", "{{.Server.Version}}"]);
if (version.status !== 0) die(`Docker indisponivel: ${(version.stderr || "").trim()}`);
log(`Docker OK (engine ${version.stdout.trim()})`);

if (docker(["image", "inspect", IMAGE]).status !== 0) {
  log(`Baixando imagem ${IMAGE}...`);
  if (docker(["pull", IMAGE], { stdio: "inherit" }).status !== 0) die("falha ao baixar imagem");
}

// ── 2. Container + cadeia completa ───────────────────────────
docker(["rm", "-f", CONTAINER]);
const run = docker([
  "run", "-d", "--name", CONTAINER,
  "-e", "POSTGRES_PASSWORD=postgres",
  "-e", "POSTGRES_DB=" + DB,
  "-e", "POSTGRES_HOST_AUTH_METHOD=trust",
  IMAGE,
]);
if (run.status !== 0) die(`docker run falhou: ${(run.stderr || "").trim()}`);
log(`Container ${CONTAINER} iniciado`);

let ready = false;
for (let i = 0; i < 60; i++) {
  if (docker(["exec", CONTAINER, "psql", "-U", USER, "-d", DB, "-tAc", "SELECT 1"]).status === 0) {
    ready = true;
    break;
  }
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
}
if (!ready) die("Postgres nao ficou pronto em 60s");
log("Postgres pronto");

log("");
log("--- Bootstrap + migrations ---");
if (!psql(readFileSync(BOOTSTRAP, "utf8"), "bootstrap")) finish(1, true);
const files = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql") && !f.endsWith(".backup.sql"))
  .sort();
for (const file of files) {
  if (!psql(readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"), file)) finish(1, true);
}
log(`${files.length} migrations aplicadas`);

// ── 3. Seed minimo ───────────────────────────────────────────
log("");
log("--- Seed (especialidade + profissional) ---");
if (
  !psql(
    `
INSERT INTO specialties (name) VALUES ('Cardiologia Teste')
ON CONFLICT (name) DO NOTHING;
INSERT INTO professionals (clinic_id, name, specialty_id, schedule)
SELECT 1, 'Dr. Concorrencia', s.id, '[]'::jsonb
FROM specialties s WHERE s.name = 'Cardiologia Teste'
AND NOT EXISTS (SELECT 1 FROM professionals WHERE name = 'Dr. Concorrencia');
`,
    "seed"
  )
)
  finish(1, true);

// ── 4. Rodadas concorrentes ──────────────────────────────────
const rounds = [
  { name: "2 insercoes simultaneas", patients: 2, slot: SLOT, expectWins: 1 },
  { name: "5 insercoes simultaneas", patients: 5, slot: SLOT2, expectWins: 1 },
];

let failures = 0;

for (const round of rounds) {
  log("");
  log(`--- ${round.name} no slot ${round.slot} ---`);
  const results = await Promise.all(
    Array.from({ length: round.patients }, (_, i) =>
      psqlExec(insertAppointment(`Paciente Corrida ${i + 1}`, round.slot))
    )
  );

  const wins = results.filter((r) => r.code === 0);
  const dupes = results.filter((r) => r.code !== 0 && /23505|duplicate key/.test(r.out));
  const other = results.filter((r) => r.code !== 0 && !/23505|duplicate key/.test(r.out));

  log(`vencedores: ${wins.length} | 23505 (duplicado): ${dupes.length} | outras falhas: ${other.length}`);
  other.forEach((r) => log(`  outra falha: ${r.out.slice(0, 200)}`));

  const countRes = docker([
    "exec", CONTAINER, "psql", "-U", USER, "-d", DB, "-tAc",
    `SELECT count(*) FROM appointments WHERE starts_at = '${round.slot}' AND status = 'scheduled';`,
  ]);
  const rowCount = (countRes.stdout || "").trim();
  log(`linhas 'scheduled' no banco para esse slot: ${rowCount}`);

  const ok =
    wins.length === round.expectWins &&
    dupes.length === round.patients - round.expectWins &&
    other.length === 0 &&
    rowCount === String(round.expectWins);

  log(ok ? "OK: somente UM agendamento venceu" : "FALHA: regra de slot violada");
  if (!ok) failures += 1;
}

// ── 5. Indice e parcial: canceladas nao disputam ─────────────
log("");
log("--- Indice parcial (status cancelado nao disputa slot) ---");
const cancel1 = await psqlExec(
  insertAppointment("Paciente Cancelado A", "2030-01-15 11:00:00").replace(
    "'scheduled'",
    "'cancelled'"
  )
);
const cancel2 = await psqlExec(
  insertAppointment("Paciente Cancelado B", "2030-01-15 11:00:00").replace(
    "'scheduled'",
    "'cancelled'"
  )
);
if (cancel1.code === 0 && cancel2.code === 0) {
  log("OK: duas 'cancelled' no mesmo slot sao permitidas (indice cobre so 'scheduled')");
} else {
  log("FALHA: esperava duas insercoes de canceladas aceitas");
  failures += 1;
}

log("");
log(failures === 0 ? "=== RESULTADO: CONCORRENCIA OK — so um vence por slot ===" : `=== RESULTADO: ${failures} RODADA(S) FALHARAM ===`);
finish(failures === 0 ? 0 : 1, true);
