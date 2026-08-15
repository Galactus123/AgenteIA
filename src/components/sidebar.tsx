"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import type { SessionData } from "@/lib/auth";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  superAdminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "▦" },
  { href: "/consultas", label: "Consultas", icon: "🗓" },
  { href: "/chat", label: "Atendimento IA", icon: "💬", superAdminOnly: true },
  { href: "/medicos", label: "Médicos", icon: "🩺" },
  { href: "/especialidades", label: "Especialidades", icon: "🏷" },
  { href: "/clinica", label: "Clínica", icon: "🏥" },
];

const isSuperAdmin = (role?: string) =>
  role === "super_admin" || role === "saas_admin";

const canAccessItem = (item: NavItem, session?: SessionData) => {
  if (!item.superAdminOnly) return true;
  if (process.env.NODE_ENV === "development") return true;
  return isSuperAdmin(session?.role);
};

export default function Sidebar({ session }: { session?: SessionData }) {
  const pathname = usePathname();
  const router = useRouter();

  const visibleItems = NAV_ITEMS.filter((item) => canAccessItem(item, session));

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <aside className="w-60 shrink-0 bg-sidebar border-r border-white/10 flex flex-col">
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
        <Link href="/dashboard" className="flex items-center gap-3">
          <Image
            src="/icon.png"
            alt="SaúdeSync"
            width={36}
            height={36}
            className="rounded-xl"
          />
          <div>
            <p className="font-semibold text-white leading-tight">SaúdeSync</p>
            <p className="text-xs text-slate-300">Recepção virtual IA</p>
          </div>
        </Link>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {visibleItems.map((item) => {
          const active =
            pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${active
                  ? "bg-accent text-sidebar"
                  : "text-slate-300 hover:bg-white/10 hover:text-white"
                }`}
            >
              <span className="w-5 text-center">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-white/10">
        <Link
          href="/perfil"
          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors mb-1 ${
            pathname === "/perfil"
              ? "bg-accent text-sidebar"
              : "text-slate-300 hover:bg-white/10 hover:text-white"
          }`}
        >
          <span className="w-5 text-center">⚙</span>
          Perfil
        </Link>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
        >
          <span className="w-5 text-center">⎋</span>
          Sair
        </button>
      </div>
    </aside>
  );
}
