import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

const ALLOWED_ROLES = ["admin", "super_admin", "saas_admin"];

export default async function ChatLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("admin_profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile?.role || !ALLOWED_ROLES.includes(profile.role)) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
