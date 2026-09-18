import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import Sidebar from "@/components/sidebar";
import AuthGuard from "@/components/auth-guard";
import DashboardShell from "@/components/dashboard/dashboard-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      redirect("/login");
    }

    // Buscar dados do admin_profile para a sidebar
    const { data: adminProfile } = await supabase
      .from("admin_profiles")
      .select("role, legacy_username")
      .eq("user_id", user.id)
      .single();

    const session = {
      adminId: 0,
      role: (adminProfile?.role ?? "admin") as "admin" | "super_admin" | "saas_admin",
      userId: user.id,
      username: adminProfile?.legacy_username ?? user.email ?? "",
    };

    return (
      <AuthGuard>
        <div className="flex min-h-screen bg-background overflow-x-hidden">
          <Sidebar session={session} />
          <DashboardShell>{children}</DashboardShell>
        </div>
      </AuthGuard>
    );
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") {
      throw error;
    }
    redirect("/login");
  }
}
