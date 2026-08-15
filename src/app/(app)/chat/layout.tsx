import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { authCookie, readSessionToken, type AdminRole } from "@/lib/auth";

const ALLOWED_ROLES: AdminRole[] = ["super_admin", "saas_admin"];

export default async function ChatLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get(authCookie)?.value;
  const session = readSessionToken(token);

  const isAllowed =
    process.env.NODE_ENV === "development" ||
    (session !== null && ALLOWED_ROLES.includes(session.role));

  if (!isAllowed) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
