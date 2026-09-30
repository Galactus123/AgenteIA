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
const OLD_ID = "cd4ac28d-cb65-4b39-9578-ad23c1c46c4d";

async function main() {
  console.log("--- Check admin_profiles ---");
  const { data: ap, error: apErr } = await client.from("admin_profiles").select("*").eq("user_id", NEW_ID);
  console.log("admin_profiles for NEW_ID:", JSON.stringify(ap, null, 2));
  if (apErr) console.log("  error:", apErr.message);

  const { data: apOld } = await client.from("admin_profiles").select("*").eq("user_id", OLD_ID);
  console.log("admin_profiles for OLD_ID:", JSON.stringify(apOld, null, 2));

  console.log("\n--- Check clinic_members ---");
  const { data: cm } = await client.from("clinic_members").select("*").eq("user_id", NEW_ID);
  console.log("clinic_members for NEW_ID:", JSON.stringify(cm, null, 2));

  const { data: cmOld } = await client.from("clinic_members").select("*").eq("user_id", OLD_ID);
  console.log("clinic_members for OLD_ID:", JSON.stringify(cmOld, null, 2));

  // Check all clinic_members
  const { data: allCm } = await client.from("clinic_members").select("*").order("created_at", { ascending: false }).limit(10);
  console.log("\nAll clinic_members (last 10):", JSON.stringify(allCm, null, 2));

  // Check all admin_profiles
  const { data: allAp } = await client.from("admin_profiles").select("*").order("created_at", { ascending: false }).limit(10);
  console.log("\nAll admin_profiles (last 10):", JSON.stringify(allAp, null, 2));
}

main().catch(console.error);
