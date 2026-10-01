import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import Sidebar from "@/components/sidebar";
import AuthGuard from "@/components/auth-guard";
import DashboardShell from "@/components/dashboard/dashboard-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/login");
    }
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") {
      throw error;
    }
    redirect("/login");
  }

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background overflow-x-hidden">
        <Sidebar />
        <DashboardShell>{children}</DashboardShell>
      </div>
    </AuthGuard>
  );
}
