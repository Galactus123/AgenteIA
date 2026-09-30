#!/usr/bin/env node
// ============================================================
// SaudeSync — setup-supabase.mjs
// Migra os dados do SQLite legado (data/saudesync.db) para o
// Supabase (PostgREST + service_role).
//
// Uso:
//   node scripts/setup-supabase.mjs            -> dry-run (mostra o plano)
//   node scripts/setup-supabase.mjs --apply    -> executa as escritas
//   node scripts/setup-supabase.mjs --db <caminho>
//   node scripts/setup-supabase.mjs --skip-preflight
//
// Garantias:
//   - Idempotente: reexecutar nao duplica (chaves naturais).
//   - Sem DELETE e sem UPDATE destrutivo: so insere linhas novas
//     e preenche campos vazios (descricao/keywords de especialidades).
//   - `conversations.phone` e unico (migracao 006) e o app normaliza
//     o telefone para digitos — telefones duplicados do SQLite sao
//     fundidos numa unica conversa com a soma das mensagens.
// ============================================================

import { readFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
const SKIP_PREFLIGHT = argv.includes("--skip-preflight");

function argValue(name) {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : null;
}

const DB_PATH = path.resolve(ROOT, argValue("--db") || "data/saudesync.db");

// ── env ─────────────────────────────────────────────────────

function loadEnv(file) {
  if (!existsSync(file)) return {};
  const out = {};
  for (const rawLine of readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const m = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let value = m[2];
    if (value.startsWith("<<")) continue;
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1);
    }
    out[m[1]] = value;
  }
  return out;
}

const env = { ...loadEnv(path.join(ROOT, ".env")), ...process.env };
const SUPABASE_URL = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

// ── helpers ─────────────────────────────────────────────────

const log = (...args) => console.log(...args);
const ok = (msg) => log(`  \x1b[32m✔\x1b[0m ${msg}`);
const warn = (msg) => log(`  \x1b[33m•\x1b[0m ${msg}`);
const fail = (msg) => log(`  \x1b[31m✘\x1b[0m ${msg}`);
const head = (msg) => log(`\n\x1b[1m${msg}\x1b[0m`);

async function rest(pathname, { method = "GET", body, headers = {} } = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathname}`, {
    method,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    const detail =
      typeof data === "object" && data
        ? `${data.message ?? ""} ${data.details ?? ""} ${data.hint ?? ""}`.trim()
        : String(data).slice(0, 400);
    throw new Error(`${method} ${pathname} -> ${res.status} ${detail}`);
  }
  return data;
}

const select = (pathname) => rest(pathname);

async function insert(table, rows) {
  if (!rows.length) return [];
  const out = await rest(table, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: rows,
  });
  return Array.isArray(out) ? out : [out];
}

async function update(table, id, patch) {
  return rest(`${table}?id=eq.${id}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: patch,
  });
}

// O app grava timestamps como "YYYY-MM-DD HH:MM" (ver datetime.ts/formatDateTime).
function normalizeTs(value) {
  if (!value) return value;
  const s = String(value).replace("T", " ");
  if (s.length >= 19) return s.slice(0, 16);
  return s;
}

function normalizePhone(value) {
  return String(value ?? "").replace(/\D/g, "");
}

const counts = { inserted: 0, updated: 0, skipped: 0 };

function recordInserted(table, n) {
  if (n > 0) {
    counts.inserted += n;
    ok(`${table}: ${n} linha(s) ${APPLY ? "inserida(s)" : "a inserir (dry-run)"}`);
  } else {
    counts.skipped += 1;
    warn(`${table}: nada a inserir (ja migrado)`);
  }
}

// ── main ────────────────────────────────────────────────────

async function main() {
  log(`\n\x1b[1mSaudeSync — migracao SQLite -> Supabase\x1b[0m`);
  log(`  modo: ${APPLY ? "\x1b[36mAPPLY (escrita)\x1b[0m" : "\x1b[33mDRY-RUN (somente leitura)\x1b[0m"}`);

  // 0. Validacoes de ambiente --------------------------------
  head("0. Pre-flight");

  if (!existsSync(DB_PATH) || !statSync(DB_PATH).isFile()) {
    fail(`SQLite nao encontrado: ${DB_PATH}`);
    process.exit(1);
  }
  ok(`SQLite: ${DB_PATH}`);

  if (!SUPABASE_URL || !SERVICE_KEY) {
    fail("SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente no .env");
    process.exit(1);
  }
  ok(`Supabase: ${SUPABASE_URL}`);

  const db = new DatabaseSync(DB_PATH, { readOnly: true });

  const sqliteCounts = {};
  for (const { name } of db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all()) {
    sqliteCounts[name] = db.prepare(`SELECT COUNT(*) AS c FROM "${name}"`).get().c;
  }
  const withData = Object.entries(sqliteCounts).filter(([, c]) => c > 0);
  ok(
    `SQLite com dados: ${withData.map(([t, c]) => `${t}(${c})`).join(", ") || "(vazio)"}`
  );

  if (!SKIP_PREFLIGHT) {
    const probes = [
      {
        label: "professionals -> specialties",
        migration: "20260930000006_professionals_unification.sql",
        path: "professionals?select=id,specialties(name)&limit=1",
      },
      {
        label: "appointments -> professionals",
        migration: "20260930000006_professionals_unification.sql",
        path: "appointments?select=id,professionals(name)&limit=1",
      },
      {
        label: "appointments -> specialties",
        migration: "20260930000006_professionals_unification.sql",
        path: "appointments?select=id,specialties(name)&limit=1",
      },
      {
        label: "appointments -> clinics",
        migration: "20260930000007_appointments_clinic_fk.sql",
        path: "appointments?select=id,clinics(name,address)&limit=1",
      },
    ];
    const broken = [];
    for (const p of probes) {
      try {
        await select(p.path);
      } catch (err) {
        broken.push(p);
        fail(`${p.label}: ${err.message}`);
      }
    }
    if (broken.length) {
      const needed = [...new Set(broken.map((p) => p.migration))];
      fail("");
      fail("Foreign keys ainda ausentes no banco. Sem elas o PostgREST nao serve");
      fail("os embeddings que o app usa e as paginas de consultas/dashboard");
      fail("quebram com PGRST200.");
      fail("");
      fail("Aplique no SQL Editor do Supabase (nesta ordem):");
      needed.forEach((m, i) => fail(`  ${i + 1}. supabase/migrations/${m}`));
      fail("As migracoes sao idempotentes — pode reexecutar sem efeito colateral.");
      fail("(ou use --skip-preflight para migrar mesmo assim)");
      process.exit(1);
    }
    ok("Foreign keys de 006 e 007 presentes (embeddings OK)");
  } else {
    warn("preflight de FKs ignorado (--skip-preflight)");
  }

  // 1. clinic -------------------------------------------------
  head("1. clinics");
  const srcClinics = db.prepare("SELECT * FROM clinics ORDER BY id").all();
  const dstClinics = await select("clinics?select=*&order=id");
  let clinicId = dstClinics[0]?.id ?? null;

  if (!dstClinics.length) {
    if (srcClinics.length) {
      const rows = srcClinics.map((c) => ({
        name: c.name,
        address: c.address ?? "",
        phone: c.phone ?? "",
        whatsapp: c.whatsapp ?? "",
        opening_hours: c.opening_hours ?? "",
        location: c.location ?? "",
        social_media: c.social_media ?? '{"facebook":"","instagram":""}',
        token_limit: c.token_limit ?? 100000,
        base_token_limit: c.base_token_limit ?? 100000,
        current_token_usage: c.current_token_usage ?? 0,
        near_limit_notified: c.near_limit_notified ?? 0,
        overage_blocks_purchased: c.overage_blocks_purchased ?? 0,
        subscription_status: c.subscription_status ?? "active",
        billing_cycle_day: c.billing_cycle_day ?? 1,
        last_reset_at: c.last_reset_at ?? null,
      }));
      if (APPLY) {
        const created = await insert("clinics", rows);
        clinicId = created[0]?.id ?? null;
      }
      recordInserted("clinics", rows.length);
    } else {
      warn("nenhuma clinica no SQLite e nenhuma no Supabase (o seed da migracao 006 cria uma)");
    }
  } else {
    ok(`clinics: ja existe id=${clinicId} "${dstClinics[0].name}"`);
    if (srcClinics.length) {
      const s = srcClinics[0];
      const d = dstClinics[0];
      const diffs = ["name", "address", "phone", "whatsapp", "opening_hours", "location"]
        .filter((k) => (s[k] ?? "") !== (d[k] ?? ""))
        .map((k) => `${k}: supabase="${d[k] ?? ""}" sqlite="${s[k] ?? ""}"`);
      if (diffs.length) {
        warn("diferenças de texto (nao alteradas automaticamente):");
        diffs.forEach((x) => warn(`   ${x}`));
      }
      if ((s.current_token_usage ?? 0) !== (d.current_token_usage ?? 0)) {
        warn(
          `current_token_usage divergente (supabase=${d.current_token_usage}, sqlite=${s.current_token_usage}) — mantido o do Supabase (contador ao vivo)`
        );
      }
    }
  }

  // 2. specialties -------------------------------------------
  head("2. specialties");
  const srcSpecs = db.prepare("SELECT * FROM specialties ORDER BY id").all();
  const dstSpecs = await select("specialties?select=id,name,description,keywords,clinic_id&order=id");
  const specByName = new Map(dstSpecs.map((s) => [s.name, s]));
  const specIdMap = new Map(); // sqlite id -> supabase id

  const newSpecs = [];
  for (const s of srcSpecs) {
    const existing = specByName.get(s.name);
    if (existing) {
      specIdMap.set(s.id, existing.id);
      continue;
    }
    newSpecs.push({
      name: s.name,
      description: s.description ?? "",
      keywords: s.keywords ?? "[]",
      clinic_id: clinicId ?? dstSpecs[0]?.clinic_id ?? null,
    });
  }

  if (APPLY && newSpecs.length) {
    const created = await insert("specialties", newSpecs);
    for (const row of created) specByName.set(row.name, row);
    for (const s of srcSpecs) {
      const found = specByName.get(s.name);
      if (found) specIdMap.set(s.id, found.id);
    }
  }
  recordInserted("specialties", newSpecs.length);
  if (newSpecs.length) newSpecs.forEach((s) => warn(`   + ${s.name}`));

  // Backfill de descricao/keywords quando estao vazias no Supabase.
  const backfill = [];
  for (const s of srcSpecs) {
    const target = specByName.get(s.name);
    if (!target) continue;
    const patch = {};
    if (!target.description && s.description) patch.description = s.description;
    if ((!target.keywords || target.keywords === "[]") && s.keywords && s.keywords !== "[]") {
      patch.keywords = s.keywords;
    }
    if (Object.keys(patch).length) backfill.push({ id: target.id, ...patch });
  }
  if (APPLY) {
    for (const b of backfill) {
      const { id, ...patch } = b;
      await update("specialties", id, patch);
    }
  }
  counts.updated += backfill.length;
  if (backfill.length) ok(`specialties: ${backfill.length} descricao(s)/keyword(s) preenchida(s)`);
  const totalSpecs = specByName.size + (APPLY ? 0 : newSpecs.length);
  warn(
    `specialties: ${specIdMap.size}/${srcSpecs.length} ja existem no Supabase; ${newSpecs.length} a criar; ${totalSpecs} no total apos a migracao`
  );

  // 3. doctors -> professionals ------------------------------
  head("3. doctors -> professionals");
  const srcDocs = db.prepare("SELECT * FROM doctors ORDER BY id").all();
  const srcSched = db
    .prepare("SELECT doctor_id, weekday, start_time, end_time FROM doctor_schedule ORDER BY doctor_id, weekday, start_time")
    .all();
  const schedByDoctor = new Map();
  for (const row of srcSched) {
    if (!schedByDoctor.has(row.doctor_id)) schedByDoctor.set(row.doctor_id, []);
    schedByDoctor.get(row.doctor_id).push({
      weekday: row.weekday,
      start_time: row.start_time,
      end_time: row.end_time,
    });
  }

  const dstProfs = await select("professionals?select=id,name,clinic_id,specialty_id,schedule");
  const profByName = new Map(dstProfs.map((p) => [`${p.clinic_id ?? 0}|${p.name}`, p]));

  const newProfs = [];
  for (const d of srcDocs) {
    const key = `${clinicId ?? 0}|${d.name}`;
    if (profByName.has(key)) continue;
    const srcSpecId = d.specialty_id;
    const mappedSpecId = srcSpecId == null ? null : specIdMap.get(srcSpecId) ?? null;
    const specName = srcSpecId == null
      ? ""
      : srcSpecs.find((s) => s.id === srcSpecId)?.name ?? "";
    newProfs.push({
      clinic_id: clinicId,
      name: d.name,
      specialty_name: specName,
      specialty_id: mappedSpecId,
      phone: d.phone ?? "",
      email: d.email ?? "",
      consultation_duration: d.consultation_duration ?? 30,
      price: d.price ?? 0,
      status: String(d.status ?? "active").toLowerCase() === "inactive" ? "inactive" : "active",
      schedule: schedByDoctor.get(d.id) ?? [],
    });
    if (srcSpecId != null && mappedSpecId == null && APPLY) {
      warn(`   ! ${d.name}: specialty_id ${srcSpecId} sem correspondente — ficara nulo`);
    }
  }

  if (APPLY && newProfs.length) await insert("professionals", newProfs);
  recordInserted("professionals", newProfs.length);
  newProfs.forEach((p) => warn(`   + ${p.name} (${p.specialty_name || "sem especialidade"}, ${p.schedule.length} dia(s))`));
  warn(`professionals: ${dstProfs.length} ja existentes, ${newProfs.length} a inserir`);

  // 4. admins -------------------------------------------------
  head("4. admins");
  const srcAdmins = db.prepare("SELECT id, username, password_hash, role, email FROM admins ORDER BY id").all();
  const dstAdmins = await select("admins?select=id,username,email,role&order=id");
  const adminByUsername = new Map(dstAdmins.map((a) => [a.username, a]));

  const newAdmins = [];
  for (const a of srcAdmins) {
    if (adminByUsername.has(a.username)) continue;
    const row = {
      username: a.username,
      password_hash: a.password_hash,
      role: a.role || "admin",
      clinic_id: clinicId,
    };
    if (a.email) row.email = a.email;
    newAdmins.push(row);
  }
  if (APPLY && newAdmins.length) await insert("admins", newAdmins);
  recordInserted("admins", newAdmins.length);
  newAdmins.forEach((a) => warn(`   + ${a.username} (${a.role})`));

  // Liga o admin legado ao admin_profiles, se o vinculo estiver vazio.
  const profiles = await select("admin_profiles?select=id,user_id,legacy_admin_id,legacy_username");
  const allAdminsAfter = await select("admins?select=id,username");
  const adminIdByUsername = new Map(allAdminsAfter.map((a) => [a.username, a.id]));
  const linkPatches = profiles.filter(
    (p) =>
      p.legacy_admin_id == null &&
      p.legacy_username &&
      adminIdByUsername.has(p.legacy_username)
  );
  if (APPLY) {
    for (const p of linkPatches) {
      await update("admin_profiles", p.id, { legacy_admin_id: adminIdByUsername.get(p.legacy_username) });
    }
  }
  counts.updated += linkPatches.length;
  if (linkPatches.length) {
    ok(`admin_profiles: ${linkPatches.length} legacy_admin_id preenchido(s)`);
  }

  // 5. conversations + messages -------------------------------
  head("5. conversations + messages");
  const srcConvs = db.prepare("SELECT * FROM conversations ORDER BY id").all();
  const srcMsgs = db.prepare("SELECT * FROM messages ORDER BY id").all();

  // agrupa por telefone normalizado (o app so encontra por digitos e a
  // migracao 006 torna conversations.phone unico).
  const groups = new Map();
  for (const c of srcConvs) {
    const phone = normalizePhone(c.phone) || String(c.phone);
    if (!groups.has(phone)) groups.set(phone, []);
    groups.get(phone).push(c);
  }

  const merged = [];
  for (const [phone, members] of groups) {
    const memberIds = new Set(members.map((m) => m.id));
    const msgs = srcMsgs
      .filter((m) => memberIds.has(m.conversation_id))
      .sort((a, b) => a.id - b.id);
    merged.push({
      phone,
      patient_name: members.map((m) => m.patient_name).find((n) => n) ?? "",
      status: members.map((m) => m.status).find((s) => s) || "open",
      created_at: normalizeTs(members.map((m) => m.created_at).sort()[0]),
      updated_at: normalizeTs(members.map((m) => m.updated_at).sort().slice(-1)[0]),
      clinic_id: clinicId,
      messages: msgs,
    });
  }
  merged.sort((a, b) => a.created_at.localeCompare(b.created_at) || a.phone.localeCompare(b.phone));

  const dstConvs = await select("conversations?select=id,phone,created_at,updated_at,status&order=id");
  const dstByPhone = new Map(dstConvs.map((c) => [c.phone, c]));

  const newConvs = merged.filter((m) => !dstByPhone.has(m.phone));
  if (APPLY && newConvs.length) {
    await insert(
      "conversations",
      newConvs.map((c) => ({
        phone: c.phone,
        patient_name: c.patient_name,
        status: c.status,
        created_at: c.created_at,
        updated_at: c.updated_at,
        clinic_id: c.clinic_id,
      }))
    );
    const after = await select("conversations?select=id,phone&order=id");
    for (const c of after) dstByPhone.set(c.phone, c);
  }
  recordInserted("conversations", newConvs.length);
  newConvs.forEach((c) => warn(`   + ${c.phone} (${c.messages.length} msg)`));

  // mensagens: conversas novas levam todo o historico; as ja existentes
  // so recebem mensagens se estiverem vazias (evita duplicar).
  const dstMsgCounts = new Map();
  if (dstConvs.length) {
    for (const m of await select("messages?select=conversation_id")) {
      dstMsgCounts.set(m.conversation_id, (dstMsgCounts.get(m.conversation_id) ?? 0) + 1);
    }
  }

  const newPhones = new Set(newConvs.map((c) => c.phone));
  const newMsgs = [];
  let msgConvs = 0;
  for (const c of merged) {
    const target = dstByPhone.get(c.phone);
    if (!target && !newPhones.has(c.phone)) continue;
    const existingCount = target ? (dstMsgCounts.get(target.id) ?? 0) : 0;
    if (existingCount > 0) continue;
    if (!c.messages.length) continue;
    msgConvs += 1;
    for (const m of c.messages) {
      newMsgs.push({
        conversation_id: target?.id ?? null,
        sender: m.sender,
        content: m.content,
        created_at: normalizeTs(m.created_at),
      });
    }
  }
  if (APPLY && newMsgs.length) {
    for (let i = 0; i < newMsgs.length; i += 500) {
      await insert("messages", newMsgs.slice(i, i + 500));
    }
  }
  recordInserted("messages", newMsgs.length);
  if (newMsgs.length) warn(`   em ${msgConvs} conversa(s)`);

  if (srcConvs.length !== merged.length) {
    warn(
      `telefones fundidos: ${srcConvs.length} conversas SQLite -> ${merged.length} conversas (telefones normalizados para digitos)`
    );
  }

  // 6. tabelas sem dados no SQLite ---------------------------
  head("6. tabelas vazias no SQLite");
  const empty = Object.entries(sqliteCounts)
    .filter(([, c]) => c === 0)
    .map(([t]) => t);
  warn(empty.length ? empty.join(", ") : "(nenhuma)");

  // 7. resumo -------------------------------------------------
  head("Resumo");
  log(`  modo .......... ${APPLY ? "APPLY" : "DRY-RUN"}`);
  log(`  inseridos ..... ${counts.inserted}`);
  log(`  atualizados ... ${counts.updated}`);
  log(`  passos sem acao ${counts.skipped}`);
  if (!APPLY) {
    log("");
    warn("Dry-run: nada foi gravado. Rode com --apply para executar.");
  } else {
    log("");
    ok("Migracao concluida.");
  }

  log("");
  log("\x1b[1mProximos passos\x1b[0m");
  log("  1. Aplique no SQL Editor do Supabase:");
  log("       supabase/migrations/20260930000006_professionals_unification.sql");
  log("       supabase/migrations/20260930000007_appointments_clinic_fk.sql");
  log("  2. Rode este script sem argumentos para confirmar o preflight.");
  log("  3. npm run lint && npx tsc --noEmit && npm test && npm run build");
  log("  4. Publique e verifique /medicos, /consultas e /chat.");
}

main().catch((err) => {
  console.error("\n\x1b[31mErro:\x1b[0m", err.message);
  process.exit(1);
});
