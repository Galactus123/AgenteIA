#!/usr/bin/env node
// ============================================================
// SaudeSync — ops/recreate-auth-user.mjs  (DESTRUTIVO)
//
// Recria o usuario de admin no Supabase Auth quando auth.users
// esta corrompido (caso classico: migration 005 inseriu linhas
// direto na tabela auth.users). Apaga e recria o usuario e
// religa admin_profiles / clinic_members ao novo UUID.
//
// Pre-requisito: scripts/ops/fix-auth-schema.sql executado no
// SQL Editor, se o registro corrompido persistir.
//
// Uso:
//   OPS_ADMIN_EMAIL=... OPS_ADMIN_PASSWORD=... \
//     node scripts/ops/recreate-auth-user.mjs
//
// Nenhuma senha fica no repositorio: veja scripts/ops/README.md.
// ============================================================

import { createClient } from "@supabase/supabase-js";
import { loadRootEnv } from "./env.mjs";

const env = loadRootEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const EMAIL = env.OPS_ADMIN_EMAIL;
const PASSWORD = env.OPS_ADMIN_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error("Defina OPS_ADMIN_EMAIL e OPS_ADMIN_PASSWORD no .env (nao versionado).");
  process.exit(1);
}

const adminClient = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log("=== RECRIAR USUARIO NO AUTH ===");
  console.log("Email:", EMAIL);
  console.log("O usuario sera APAGADO e recriado. Ctrl+C para cancelar.\n");

  console.log("--- STEP 1: localizar usuario atual ---");
  const { data: existing, error: checkErr } = await adminClient.auth.admin.listUsers({
    perPage: 100,
  });
  if (checkErr) console.log("listUsers:", checkErr.message, "(continuando)");

  const found = existing?.users.find((u) => u.email === EMAIL);
  const oldUserId = found?.id ?? null;
  console.log(oldUserId ? `Usuario atual: ${oldUserId}` : "Usuario nao existe (sera criado).");

  if (oldUserId) {
    console.log("\n--- STEP 2: apagar registro possivelmente corrompido ---");
    const { error: delErr } = await adminClient.auth.admin.deleteUser(oldUserId);
    console.log(delErr ? "delete: " + delErr.message : "apagado.");
  }

  console.log("\n--- STEP 3: criar via admin API ---");
  const { data, error } = await adminClient.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: "Admin" },
  });
  if (error) {
    console.error("ERRO ao criar usuario:", error.message);
    console.log("Verifique: fix-auth-schema.sql executado? Auth > Providers ativo?");
    process.exit(1);
  }
  const userId = data.user.id;
  console.log("Usuario criado:", userId);

  if (oldUserId && oldUserId !== userId) {
    console.log("\n--- STEP 4: religar tenant ao novo UUID ---");
    for (const table of ["admin_profiles", "clinic_members", "profiles"]) {
      const { error: upErr } = await adminClient
        .from(table)
        .update({ user_id: userId })
        .eq("user_id", oldUserId);
      console.log(`${table}:`, upErr ? "ERRO " + upErr.message : "OK");
    }
  }

  console.log("\n--- STEP 5: testar login ---");
  const testClient = createClient(url, anonKey);
  const { data: signInData, error: signInErr } = await testClient.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  });
  if (signInErr) {
    console.error("ERRO no login:", signInErr.message);
    process.exit(1);
  }
  console.log("LOGIN OK:", signInData.user.email, signInData.user.id);

  console.log("\n--- STEP 6: verificar tenant ---");
  const { data: profile } = await adminClient
    .from("admin_profiles")
    .select("role, legacy_username")
    .eq("user_id", userId)
    .maybeSingle();
  console.log("admin_profiles:", profile ? JSON.stringify(profile) : "AUSENTE");

  const { data: clinics } = await adminClient
    .from("clinic_members")
    .select("clinic_id, role, active")
    .eq("user_id", userId);
  console.log("clinic_members:", JSON.stringify(clinics ?? []));

  if (!profile || !clinics?.length) {
    console.log("\nTenant incompleto -> rode scripts/ops/recreate-cascade.mjs");
  }
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
