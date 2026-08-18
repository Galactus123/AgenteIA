"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
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
  const [collapsed, setCollapsed] = useState(false);

  const visibleItems = NAV_ITEMS.filter((item) => canAccessItem(item, session));

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <aside
      className={`shrink-0 bg-sidebar border-r border-white/10 flex flex-col transition-all duration-300 ${
        collapsed ? "w-[72px]" : "w-60"
      }`}
    >
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/10">
        <Link href="/dashboard" className="flex items-center gap-3 min-w-0">
          <Image
            src="/icon.png"
            alt="SaúdeSync"
            width={32}
            height={32}
            className="rounded-lg shrink-0"
          />
          {!collapsed && (
            <div className="min-w-0">
              <p className="font-semibold text-white leading-tight text-sm truncate">SaúdeSync</p>
              <p className="text-[10px] text-slate-400 truncate">Recepção virtual IA</p>
            </div>
          )}
        </Link>
      </div>

      <nav className="flex-1 px-2 py-4 space-y-0.5">
        {visibleItems.map((item) => {
          const active =
            pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                active
                  ? "bg-accent text-white shadow-sm shadow-accent/20"
                  : "text-slate-400 hover:bg-sidebar-hover hover:text-white"
              }`}
            >
              <span className="w-5 text-center text-base shrink-0">{item.icon}</span>
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="p-2 border-t border-white/10 space-y-0.5">
        <Link
          href="/perfil"
          title={collapsed ? "Perfil" : undefined}
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
            pathname === "/perfil"
              ? "bg-accent text-white shadow-sm shadow-accent/20"
              : "text-slate-400 hover:bg-sidebar-hover hover:text-white"
          }`}
        >
          <span className="w-5 text-center text-base shrink-0">⚙</span>
          {!collapsed && <span className="truncate">Perfil</span>}
        </Link>
        <button
          onClick={handleLogout}
          title={collapsed ? "Sair" : undefined}
          className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-sidebar-hover hover:text-white transition-all"
        >
          <span className="w-5 text-center text-base shrink-0">⎋</span>
          {!collapsed && <span className="truncate">Sair</span>}
        </button>
      </div>

      <button
        onClick={() => setCollapsed(!collapsed)}
        className="mx-2 mb-3 flex items-center justify-center gap-2 text-xs text-slate-500 hover:text-slate-300 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
      >
        <span className={`transition-transform duration-300 ${collapsed ? "rotate-180" : ""}`}>◀</span>
        {!collapsed && <span>Recolher</span>}
      </button>
    </aside>
  );
}
