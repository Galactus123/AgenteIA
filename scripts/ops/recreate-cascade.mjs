#!/usr/bin/env node
// ============================================================
// SaudeSync — ops/recreate-cascade.mjs
//
// Recria, para o usuario de admin, os registros de tenant que o
// RLS exige e que se perdem quando auth.users e recriado:
//   profiles -> admin_profiles -> clinic_members (vinculo a clínica)
// Sem eles o login "funciona" mas todo painel volta vazio.
//
// Uso:
//   OPS_ADMIN_EMAIL=... OPS_ADMIN_PASSWORD=... \
//     node scripts/ops/recreate-cascade.mjs
//
// Idempotente: so insere o que falta (chaves naturais).
// Nenhuma senha fica no repositorio: veja scripts/ops/README.md.
// ============================================================

import { createClient } from "@supabase/supabase-js";
import { loadRootEnv } from "./env.mjs";

const env = loadRootEnv();
const EMAIL = env.OPS_ADMIN_EMAIL;
const PASSWORD = env.OPS_ADMIN_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error("Defina OPS_ADMIN_EMAIL e OPS_ADMIN_PASSWORD no .env (nao versionado).");
  process.exit(1);
}

const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log("=== RECRIAR TENANT DO ADMIN ===\n");

  const { data: users, error: listErr } = await client.auth.admin.listUsers({ perPage: 100 });
  if (listErr) {
    console.error("listUsers:", listErr.message);
    process.exit(1);
  }
  const user = users.users.find((u) => u.email === EMAIL);
  if (!user) {
    console.error(`Usuario ${EMAIL} nao existe. Rode recreate-auth-user.mjs antes.`);
    process.exit(1);
  }
  const userId = user.id;
  console.log("User ID:", userId);

  const { data: clinics } = await client.from("clinics").select("id, name").order("id");
  if (!clinics?.length) {
    console.error("Nenhuma clinica encontrada.");
    process.exit(1);
  }
  const clinicId = clinics[0].id;
  console.log(`Clinica: ${clinicId} (${clinics[0].name})`);

  const steps = [
    {
      table: "profiles",
      exists: () =>
        client.from("profiles").select("id").eq("user_id", userId).maybeSingle(),
      insert: { user_id: userId, display_name: EMAIL.split("@")[0] },
    },
    {
      table: "admin_profiles",
      exists: () =>
        client.from("admin_profiles").select("id").eq("user_id", userId).maybeSingle(),
      insert: { user_id: userId, legacy_username: "admin", role: "admin" },
    },
    {
      table: "clinic_members",
      exists: () =>
        client.from("clinic_members").select("id").eq("user_id", userId).maybeSingle(),
      insert: { clinic_id: clinicId, user_id: userId, role: "owner", active: true },
    },
  ];

  for (const step of steps) {
    const { data: current, error: checkErr } = await step.exists();
    if (checkErr) {
      console.error(`${step.table}: erro ao consultar:`, checkErr.message);
      process.exit(1);
    }
    if (current) {
      console.log(`${step.table}: ja existe`);
      continue;
    }
    const { error: insErr } = await client.from(step.table).insert(step.insert);
    console.log(`${step.table}:`, insErr ? "ERRO " + insErr.message : "criado");
    if (insErr) process.exit(1);
  }

  console.log("\n--- Verificacao ---");
  const { data: profile } = await client
    .from("admin_profiles")
    .select("role, legacy_username")
    .eq("user_id", userId)
    .maybeSingle();
  console.log("admin_profiles:", profile ? JSON.stringify(profile) : "AUSENTE");

  const { data: members } = await client
    .from("clinic_members")
    .select("clinic_id, role, active")
    .eq("user_id", userId);
  console.log("clinic_members:", JSON.stringify(members ?? []));

  console.log("\n--- Testando login ---");
  const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: signIn, error: signInErr } = await anon.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  });
  if (signInErr) {
    console.error("ERRO login:", signInErr.message);
    process.exit(1);
  }
  console.log("LOGIN OK:", signIn.user.email, signIn.user.id);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
