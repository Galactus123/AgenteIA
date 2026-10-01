#!/usr/bin/env node
// ============================================================
// SaudeSync — ops/check-user.mjs
// Conferencia rapida do tenant de um usuario:
//   admin_profiles, clinic_members, profiles e clinic_ids.
//
// Uso:
//   OPS_ADMIN_EMAIL=user@exemplo.com node scripts/ops/check-user.mjs
// ============================================================

import { createClient } from "@supabase/supabase-js";
import { loadRootEnv } from "./env.mjs";

const env = loadRootEnv();
const EMAIL = env.OPS_ADMIN_EMAIL;

if (!EMAIL) {
  console.error("Defina OPS_ADMIN_EMAIL no .env (nao versionado).");
  process.exit(1);
}

const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { data: users, error } = await client.auth.admin.listUsers({ perPage: 100 });
  if (error) {
    console.error("listUsers:", error.message);
    process.exit(1);
  }
  const user = users.users.find((u) => u.email === EMAIL);
  if (!user) {
    console.error(`Usuario ${EMAIL} nao encontrado em auth.users.`);
    process.exit(1);
  }
  const userId = user.id;
  console.log(`Usuario: ${EMAIL} (${userId})\n`);

  for (const table of ["profiles", "admin_profiles", "clinic_members"]) {
    const { data, error: qErr } = await client.from(table).select("*").eq("user_id", userId);
    console.log(`${table}:`, qErr ? `ERRO ${qErr.message}` : JSON.stringify(data, null, 2));
  }

  const { data: all } = await client
    .from("clinic_members")
    .select("clinic_id, user_id, role, active")
    .order("created_at", { ascending: false })
    .limit(10);
  console.log("\nclinic_members (ultimos 10):", JSON.stringify(all ?? [], null, 2));
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
