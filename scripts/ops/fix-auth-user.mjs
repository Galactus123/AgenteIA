#!/usr/bin/env node
// ============================================================
// SaudeSync — ops/fix-auth-user.mjs  (DIAGNOSTICO DE auth.users)
//
// Verifica se o schema auth do Supabase esta funcional criando
// um usuario temporario (senha gerada) e removendo-o em seguida.
//
// Uso:
//   node scripts/ops/fix-auth-user.mjs            -> diagnostico
//   node scripts/ops/fix-auth-user.mjs --recreate -> diagnostico +
//        recria o usuario de admin (exige OPS_ADMIN_PASSWORD)
//
// Nenhuma senha fica no repositorio: veja scripts/ops/README.md.
// ============================================================

import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { loadRootEnv } from "./env.mjs";

const env = loadRootEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

const RECREATE = process.argv.includes("--recreate");
const TARGET_EMAIL = env.OPS_ADMIN_EMAIL;
const TARGET_PASSWORD = env.OPS_ADMIN_PASSWORD;

const client = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log("=== DIAGNOSTICO DO SCHEMA AUTH ===\n");

  console.log("--- auth.admin.listUsers (primeiros 5) ---");
  const { data, error } = await client.auth.admin.listUsers({ perPage: 5 });
  if (error) {
    console.log("Erro:", error.message, "(status:", error.status, ")");
  } else {
    console.log("Usuarios encontrados:", data.users.length);
    for (const u of data.users) {
      console.log("  id:", u.id, "email:", u.email);
    }
  }

  console.log("\n--- Criando usuario temporario para testar o schema ---");
  const testEmail = `test-fix-${Date.now()}@test.local`;
  const testPassword = randomBytes(16).toString("base64url");
  const { data: testData, error: testErr } = await client.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true,
  });

  if (testErr) {
    console.log("ERRO ao criar usuario de teste:", testErr.message, "(status:", testErr.status + ")");
    console.log("=> schema auth quebrado no banco. Execute scripts/ops/diagnose-auth-schema.sql");
    console.log("   no SQL Editor do Supabase antes de qualquer outra coisa.");
    process.exit(1);
  }

  console.log("Usuario de teste OK:", testData.user.id);
  await client.auth.admin.deleteUser(testData.user.id);
  console.log("Usuario de teste removido.");

  if (!RECREATE) {
    console.log("\nDiagnostico concluido. (use --recreate para recriar o admin)");
    return;
  }

  if (!TARGET_EMAIL || !TARGET_PASSWORD) {
    console.error(
      "\nFalta OPS_ADMIN_EMAIL / OPS_ADMIN_PASSWORD. Defina-as no .env " +
        "(nao versionado) antes de usar --recreate."
    );
    process.exit(1);
  }

  console.log("\n--- Recriando usuario de admin ---");
  const { data: existing } = await client.auth.admin.listUsers({ perPage: 100 });
  const found = existing?.users.find((u) => u.email === TARGET_EMAIL);
  if (found) {
    console.log("Removendo usuario existente:", found.id);
    await client.auth.admin.deleteUser(found.id);
  }

  const { data: created, error: createErr } = await client.auth.admin.createUser({
    email: TARGET_EMAIL,
    password: TARGET_PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: "Admin" },
  });
  if (createErr) {
    console.error("ERRO ao recriar usuario:", createErr.message);
    process.exit(1);
  }
  console.log("Usuario recriado:", created.user.id, "-", TARGET_EMAIL);
  console.log(
    "\nATENÇÃO: admin_profiles/clinic_members ainda apontam para o UUID antigo." +
      "\nRode scripts/ops/recreate-cascade.mjs para religar o tenant."
  );
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
