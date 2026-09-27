import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const envText = readFileSync(".env", "utf-8");
const env = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim();
}

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const adminClient = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const EMAIL = "galactusbank77@gmail.com";
const PASSWORD = "Saudesync2026!";

async function main() {
  console.log("=== RECRIAR USUARIO NO AUTH ===");
  console.log("Email:", EMAIL);
  console.log("NOTA: Execute o fix-auth-schema.sql no Dashboard ANTES deste script!\n");

  // 1. Verificar se o email ainda existe (deve ter sido deletado pelo SQL)
  console.log("--- STEP 1: Verificar se email foi limpo ---");
  const { data: existing, error: checkErr } = await adminClient.auth.admin.listUsers({ perPage: 50 });
  if (checkErr) {
    console.log("listUsers error (pode ser esperado):", checkErr.message);
    console.log("Continuando mesmo assim...\n");
  } else {
    const found = existing.users.find(u => u.email === EMAIL);
    if (found) {
      console.log("AVISO: Email ainda existe (id:", found.id, "). Deletando...");
      await adminClient.auth.admin.deleteUser(found.id);
      console.log("Deletado.\n");
    } else {
      console.log("Email limpo com sucesso.\n");
    }
  }

  // 2. Criar usuario via admin API
  console.log("--- STEP 2: Criar usuario via admin API ---");
  const { data, error } = await adminClient.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: "Admin" },
  });

  if (error) {
    console.error("ERRO ao criar usuario:", JSON.stringify(error, null, 2));
    console.log("\nSe o erro persistir, verifique:");
    console.log("1. O SQL do fix-auth-schema.sql foi executado?");
    console.log("2. O Supabase Auth esta habilitado? (Dashboard > Authentication > Providers)");
    process.exit(1);
  }

  const userId = data.user.id;
  console.log("Usuario criado com ID:", userId);

  // 3. Atualizar admin_profiles para apontar para o novo ID
  console.log("\n--- STEP 3: Atualizar admin_profiles ---");
  const oldUserId = "cd4ac28d-cb65-4b39-9578-ad23c1c46c4d";
  
  const { error: upErr1 } = await adminClient
    .from("admin_profiles")
    .update({ user_id: userId })
    .eq("user_id", oldUserId);
  console.log("admin_profiles:", upErr1 ? "ERROR: " + upErr1.message : "OK");

  // 4. Atualizar clinic_members
  console.log("\n--- STEP 4: Atualizar clinic_members ---");
  const { error: upErr2 } = await adminClient
    .from("clinic_members")
    .update({ user_id: userId })
    .eq("user_id", oldUserId);
  console.log("clinic_members:", upErr2 ? "ERROR: " + upErr2.message : "OK");

  // 5. Verificar login
  console.log("\n--- STEP 5: Testar login ---");
  const testClient = createClient(url, anonKey);
  const { data: signInData, error: signInErr } = await testClient.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  });

  if (signInErr) {
    console.error("ERRO no login:", JSON.stringify(signInErr, null, 2));
  } else {
    console.log("LOGIN FUNCIONANDO! User:", signInData.user.email, "id:", signInData.user.id);
  }

  // 6. Verificar query admin_profiles
  console.log("\n--- STEP 6: Verificar admin_profiles ---");
  const { data: profile, error: profErr } = await adminClient
    .from("admin_profiles")
    .select("role, legacy_username")
    .eq("user_id", userId)
    .single();
  if (profErr) {
    console.error("admin_profiles error:", profErr.message);
  } else {
    console.log("admin_profiles OK:", JSON.stringify(profile));
  }

  // 7. Verificar clinic_members
  console.log("\n--- STEP 7: Verificar clinic_members ---");
  const { data: clinics, error: cmErr } = await adminClient
    .from("clinic_members")
    .select("clinic_id, role, active")
    .eq("user_id", userId);
  if (cmErr) {
    console.error("clinic_members error:", cmErr.message);
  } else {
    console.log("clinic_members OK:", JSON.stringify(clinics));
  }

  console.log("\n=== RESUMO ===");
  console.log("Novo User ID:", userId);
  console.log("Email:", EMAIL);
  console.log("Senha:", PASSWORD);
  console.log("URL de login: https://syncbot-123.vercel.app/login");
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
