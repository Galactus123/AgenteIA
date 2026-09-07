import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { authCookie, readSessionToken } from "@/lib/auth";
import Sidebar from "@/components/sidebar";
import AuthGuard from "@/components/auth-guard";
import DashboardShell from "@/components/dashboard/dashboard-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(authCookie)?.value;
    const session = readSessionToken(token);
    if (!session) {
      redirect("/login");
    }

    return (
      <AuthGuard>
        <div className="flex min-h-screen bg-background overflow-x-hidden">
          <Sidebar session={session} />
          <DashboardShell>{children}</DashboardShell>
        </div>
      </AuthGuard>
    );
  } catch (error) {
    // redirect() throws a special Next.js error — let it propagate
    if (error instanceof Error && error.message === "NEXT_REDIRECT") {
      throw error;
    }
    // Any other error (DB crash, auth failure, env missing) → redirect to login
    redirect("/login");
  }
}
