import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { authCookie, readSessionToken, type SessionData } from "@/lib/auth";
import Sidebar from "@/components/sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get(authCookie)?.value;
  const session = readSessionToken(token);
  if (!session) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar session={session} />
      <main className="flex-1 min-w-0 flex flex-col">
        <div className="flex-1 p-6 lg:p-8 overflow-auto">{children}</div>
      </main>
    </div>
  );
}
