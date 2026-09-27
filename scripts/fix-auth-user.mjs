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

const client = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log("=== DIAGNOSTICO DIRETO DO SCHEMA AUTH ===\n");

  // Try to query auth schema via RPC or direct query
  // Supabase doesn't allow direct SQL via JS client, but we can try the Management API
  
  // 1. Check if we can at least list all auth users via admin API (even if it fails, the error tells us something)
  console.log("--- auth.admin.listUsers (first 5) ---");
  const { data, error } = await client.auth.admin.listUsers({ perPage: 5 });
  if (error) {
    console.log("Error:", error.message, "(status:", error.status, ")");
  } else {
    console.log("Users found:", data.users.length);
    for (const u of data.users) {
      console.log("  id:", u.id, "email:", u.email);
    }
  }

  // 2. Try to create a fresh user to test if auth system works at all
  console.log("\n--- Testing auth creation with a throwaway user ---");
  const testEmail = `test-fix-${Date.now()}@test.local`;
  const { data: testData, error: testErr } = await client.auth.admin.createUser({
    email: testEmail,
    password: "TestPassword123!",
    email_confirm: true,
  });
  if (testErr) {
    console.log("ERROR creating test user:", testErr.message, "(status:", testErr.status, ")");
    console.log("This confirms the Supabase Auth schema is broken at the database level.");
    console.log("\n=== SOLUCAO ===");
    console.log("1. Acesse o Supabase Dashboard > SQL Editor");
    console.log("2. Execute o SQL de diagnóstico em scripts/diagnose-auth-schema.sql");
    console.log("3. Se auth.users estiver corrompido, pode ser necessario:");
    console.log("   a. Resetar o projeto Supabase (Settings > Infrastructure > Reset)");
    console.log("   b. OU recriar o schema auth manualmente");
  } else {
    console.log("Test user created OK:", testData.user.id, testData.user.email);
    
    // Clean up
    await client.auth.admin.deleteUser(testData.user.id);
    console.log("Test user deleted.");
    
    // Now try the actual user
    console.log("\n--- Auth works! Trying to fix the target user ---");
    
    // Delete and recreate
    const { error: delErr } = await client.auth.admin.deleteUser("cd4ac28d-cb65-4b39-9578-ad23c1c46c4d");
    if (delErr) console.log("Delete old user:", delErr.message);
    
    const { data: createData, error: createErr } = await client.auth.admin.createUser({
      id: "cd4ac28d-cb65-4b39-9578-ad23c1c46c4d",
      email: "galactusbank77@gmail.com",
      password: "Saudesync2026!",
      email_confirm: true,
      user_metadata: { display_name: "Admin" },
    });
    if (createErr) {
      console.log("ERROR recreating user:", createErr.message);
    } else {
      console.log("User recreated:", createData.user.email);
      
      // Verify signIn
      const testClient = createClient(url, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
      const { error: signInErr } = await testClient.auth.signInWithPassword({
        email: "galactusbank77@gmail.com",
        password: "Saudesync2026!",
      });
      if (signInErr) {
        console.log("signIn still fails:", signInErr.message);
      } else {
        console.log("signInWithPassword SUCCESS!");
      }
    }
  }
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
