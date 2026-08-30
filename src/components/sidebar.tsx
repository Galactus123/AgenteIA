"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
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
  { href: "/pacientes", label: "Pacientes", icon: "👥" },
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
  const [mobileOpen, setMobileOpen] = useState(false);

  const visibleItems = NAV_ITEMS.filter((item) => canAccessItem(item, session));

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  useEffect(() => {
    closeMobile();
  }, [pathname, closeMobile]);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:flex shrink-0 bg-sidebar border-r border-white/10 flex-col transition-all duration-300 ${
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

        <nav className="flex-1 px-2 py-4 space-y-0.5" aria-label="Navegação lateral">
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
                aria-current={active ? "page" : undefined}
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
          aria-label={collapsed ? "Expandir sidebar" : "Recolher sidebar"}
        >
          <span className={`transition-transform duration-300 ${collapsed ? "rotate-180" : ""}`}>◀</span>
          {!collapsed && <span>Recolher</span>}
        </button>
      </aside>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          onClick={closeMobile}
          aria-hidden="true"
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`lg:hidden fixed inset-y-0 left-0 z-50 w-72 bg-sidebar flex flex-col transform transition-transform duration-300 ease-in-out ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Navegação lateral"
        aria-hidden={!mobileOpen}
      >
        <div className="flex items-center justify-between px-4 py-5 border-b border-white/10">
          <Link href="/dashboard" className="flex items-center gap-3 min-w-0" onClick={closeMobile}>
            <Image
              src="/icon.png"
              alt="SaúdeSync"
              width={32}
              height={32}
              className="rounded-lg shrink-0"
            />
            <div className="min-w-0">
              <p className="font-semibold text-white leading-tight text-sm truncate">SaúdeSync</p>
              <p className="text-[10px] text-slate-400 truncate">Recepção virtual IA</p>
            </div>
          </Link>
          <button
            onClick={closeMobile}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Fechar menu"
          >
            ✕
          </button>
        </div>

        <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto" aria-label="Navegação lateral">
          {visibleItems.map((item) => {
            const active =
              pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all min-h-[48px] ${
                  active
                    ? "bg-accent text-white shadow-sm shadow-accent/20"
                    : "text-slate-400 hover:bg-sidebar-hover hover:text-white"
                }`}
                aria-current={active ? "page" : undefined}
              >
                <span className="w-5 text-center text-base shrink-0">{item.icon}</span>
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-2 border-t border-white/10 space-y-0.5">
          <Link
            href="/perfil"
            className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all min-h-[48px] ${
              pathname === "/perfil"
                ? "bg-accent text-white shadow-sm shadow-accent/20"
                : "text-slate-400 hover:bg-sidebar-hover hover:text-white"
            }`}
          >
            <span className="w-5 text-center text-base shrink-0">⚙</span>
            <span className="truncate">Perfil</span>
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-400 hover:bg-sidebar-hover hover:text-white transition-all min-h-[48px]"
          >
            <span className="w-5 text-center text-base shrink-0">⎋</span>
            <span className="truncate">Sair</span>
          </button>
        </div>
      </aside>

      {/* Expose openMobile via a button in the header - we use a callback pattern */}
      <MobileMenuButton onClick={() => setMobileOpen(true)} />
    </>
  );
}

function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="lg:hidden fixed top-4 left-4 z-40 p-2.5 rounded-xl bg-sidebar text-white shadow-lg hover:bg-sidebar-hover transition-colors min-w-[48px] min-h-[48px] flex items-center justify-center"
      aria-label="Abrir menu de navegação"
    >
      <span className="text-lg">☰</span>
    </button>
  );
}
