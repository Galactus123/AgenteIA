import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const envText = readFileSync(".env", "utf-8");
const env = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim();
}

const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const NEW_ID = "f9264de1-15d3-410b-a61b-94765170fbc6";

async function main() {
  console.log("=== RECRIAR REGISTROS CASCATADELETADOS ===\n");

  // 1. Recuperar clinic_id do banco
  const { data: clinics } = await client.from("clinics").select("id").limit(1);
  const clinicId = clinics?.[0]?.id;
  if (!clinicId) {
    console.error("Nenhuma clinica encontrada!");
    process.exit(1);
  }
  console.log("Clinic ID:", clinicId);

  // 2. Criar admin_profiles
  console.log("\n--- Criando admin_profiles ---");
  const { error: apErr } = await client.from("admin_profiles").insert({
    user_id: NEW_ID,
    legacy_admin_id: null,
    legacy_username: "admin",
    role: "admin",
  });
  if (apErr) {
    console.error("ERRO admin_profiles:", apErr.message, apErr.details);
  } else {
    console.log("admin_profiles criado com sucesso");
  }

  // 3. Criar clinic_members
  console.log("\n--- Criando clinic_members ---");
  const { error: cmErr } = await client.from("clinic_members").insert({
    clinic_id: clinicId,
    user_id: NEW_ID,
    role: "owner",
    active: true,
  });
  if (cmErr) {
    console.error("ERRO clinic_members:", cmErr.message, cmErr.details);
  } else {
    console.log("clinic_members criado com sucesso");
  }

  // 4. Criar profiles
  console.log("\n--- Criando profiles ---");
  const { error: prErr } = await client.from("profiles").insert({
    user_id: NEW_ID,
    display_name: "Admin",
  });
  if (prErr) {
    console.error("ERRO profiles:", prErr.message, prErr.details);
  } else {
    console.log("profiles criado com sucesso");
  }

  // 5. Verificar tudo
  console.log("\n--- Verificacao final ---");
  const { data: ap } = await client.from("admin_profiles").select("role, legacy_username").eq("user_id", NEW_ID).single();
  console.log("admin_profiles:", JSON.stringify(ap));

  const { data: cm } = await client.from("clinic_members").select("clinic_id, role, active").eq("user_id", NEW_ID).single();
  console.log("clinic_members:", JSON.stringify(cm));

  const { data: pr } = await client.from("profiles").select("display_name").eq("user_id", NEW_ID).single();
  console.log("profiles:", JSON.stringify(pr));

  // 6. Testar login
  console.log("\n--- Testando login ---");
  const anonClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const { data: signInData, error: signInErr } = await anonClient.auth.signInWithPassword({
    email: "galactusbank77@gmail.com",
    password: "Saudesync2026!",
  });
  if (signInErr) {
    console.error("ERRO login:", signInErr.message);
  } else {
    console.log("LOGIN OK! User:", signInData.user.email, "id:", signInData.user.id);
  }
}

main().catch(console.error);
