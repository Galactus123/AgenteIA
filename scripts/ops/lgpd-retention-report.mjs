#!/usr/bin/env node
// ============================================================
// Fase 6.4 - relatorio de retencao LGPD (SOMENTE LEITURA)
// ============================================================
// Mostra quanto a politica de retencao (src/lib/lgpd.ts) apagaria
// ou anonimizaria HOJE, consultando o banco real via service_role.
// NENHUMA escrita: serve para verificar a retencao com dados reais
// antes de deixar o `runRetentionPolicies` do startup agir.
//
// Uso:
//   node scripts/ops/lgpd-retention-report.mjs
//
// Requisitos no .env da raiz:
//   SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL
// ============================================================

import { loadRootEnv } from "./env.mjs";

const env = loadRootEnv();
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL_ || !KEY) {
  console.error(
    "Faltam SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_URL no .env"
  );
  process.exit(1);
}

const headers = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
  Prefer: "count=exact",
};

const daysAgo = (n) =>
  new Date(Date.now() - n * 86400000).toISOString().slice(0, 16).replace("T", " ");

async function count(table, filters = "") {
  const qs = filters ? `?${filters}` : "";
  const res = await fetch(`${URL_}/rest/v1/${table}${qs}`, {
    method: "HEAD",
    headers,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${table}: HTTP ${res.status} ${text.slice(0, 200)}`);
  }
  const range = res.headers.get("content-range") ?? "";
  const total = range.includes("/") ? Number(range.split("/")[1]) : 0;
  return Number.isFinite(total) ? total : 0;
}

const policies = [
  {
    name: "mensagens > 90 dias (seriam APAGADAS)",
    table: "messages",
    filter: `select=id&created_at=lt.${daysAgo(90)}&limit=1`,
    impact: "delete",
  },
  {
    name: "conversas inativas > 365 dias (seriam ANONIMIZADAS)",
    table: "conversations",
    filter: `select=id&and=(updated_at.lt.${daysAgo(365)},status.neq.open)&limit=1`,
    impact: "anonymize",
  },
  {
    name: "usuarios inativos > 30 dias (seriam REMOVIDOS)",
    table: "users",
    filter: `select=id&and=(status.eq.inactive,created_at.lt.${daysAgo(30)})&limit=1`,
    impact: "delete",
  },
];

console.log("=== Relatorio de retencao LGPD (somente leitura) ===");
console.log(`Momento: ${new Date().toISOString()}\n`);

// Contexto: totais por tabela (prova de que a consulta leu dados reais).
for (const t of ["messages", "conversations", "users"]) {
  try {
    const n = await count(t, "select=id&limit=1");
    console.log(`${String(n).padStart(6)}  total de linhas em ${t}`);
  } catch (err) {
    console.log(`  ERRO  total de ${t}: ${err.message}`);
  }
}
console.log("");

let failures = 0;
for (const p of policies) {
  try {
    const n = await count(p.table, p.filter);
    const pad = n === 0 ? "" : `  <-- ${p.impact}`;
    console.log(`${String(n).padStart(6)}  ${p.name}${pad}`);
  } catch (err) {
    failures += 1;
    console.log(`  ERRO  ${p.name}: ${err.message}`);
  }
}

console.log(
  "\nPoliticas aplicadas pelo app no startup: retainMessages(90), " +
    "anonymizeInactivePatients(365), purgeDeletedUsers(30)."
);
console.log("Nenhuma escrita foi feita por este relatorio.");
process.exit(failures === 0 ? 0 : 1);
