"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useCallback, memo } from "react";
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

const SidebarLink = memo(function SidebarLink({
  href,
  icon,
  label,
  active,
  collapsed,
  onClick,
}: {
  href: string;
  icon: string;
  label: string;
  active: boolean;
  collapsed: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      prefetch={true}
      title={collapsed ? label : undefined}
      onClick={onClick}
      className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
        active
          ? "text-white"
          : "text-slate-400 hover:text-white hover:bg-white/[0.04]"
      }`}
      style={active ? {
        background: "linear-gradient(135deg, rgba(79,109,245,0.15) 0%, rgba(129,140,248,0.08) 100%)",
        boxShadow: "0 0 20px rgba(79,109,245,0.15), inset 0 1px 0 rgba(255,255,255,0.05)",
        border: "1px solid rgba(99,102,241,0.2)",
      } : {
        border: "1px solid transparent",
      }}
      aria-current={active ? "page" : undefined}
    >
      {active && (
        <span
          className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
          style={{ background: "linear-gradient(180deg, #4f6df5, #818cf8)" }}
        />
      )}
      <span className="w-5 text-center text-base shrink-0">{icon}</span>
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
});

function SidebarInner({ session }: { session?: SessionData }) {
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

  const handleLogout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }, [router]);

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:flex shrink-0 flex-col transition-all duration-300 border-r border-white/[0.06] ${
          collapsed ? "w-[72px]" : "w-60"
        }`}
        style={{ background: "#0D1017" }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-white/[0.06]">
          <Link href="/dashboard" prefetch={true} className="flex items-center gap-3 min-w-0">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0"
              style={{ background: "linear-gradient(135deg, #4f6df5, #6366f1)" }}
            >
              S
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="font-semibold text-white leading-tight text-sm truncate">SaúdeSync</p>
                <p className="text-[10px] text-slate-500 truncate">Recepção virtual IA</p>
              </div>
            )}
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-4 space-y-0.5" aria-label="Navegação lateral">
          {visibleItems.map((item) => {
            const active =
              pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <SidebarLink
                key={item.href}
                href={item.href}
                icon={item.icon}
                label={item.label}
                active={active}
                collapsed={collapsed}
              />
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-2 border-t border-white/[0.06] space-y-0.5">
          <SidebarLink
            href="/perfil"
            icon="⚙"
            label="Perfil"
            active={pathname === "/perfil"}
            collapsed={collapsed}
          />
          <button
            onClick={handleLogout}
            title={collapsed ? "Sair" : undefined}
            className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 hover:text-white hover:bg-white/[0.04] transition-all duration-150 border border-transparent"
          >
            <span className="w-5 text-center text-base shrink-0">⎋</span>
            {!collapsed && <span className="truncate">Sair</span>}
          </button>
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="mx-2 mb-3 flex items-center justify-center gap-2 text-xs text-slate-500 hover:text-slate-300 py-1.5 rounded-lg hover:bg-white/[0.04] transition-colors"
          aria-label={collapsed ? "Expandir sidebar" : "Recolher sidebar"}
        >
          <span className={`transition-transform duration-300 ${collapsed ? "rotate-180" : ""}`}>◀</span>
          {!collapsed && <span>Recolher</span>}
        </button>
      </aside>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          onClick={closeMobile}
          aria-hidden="true"
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`lg:hidden fixed inset-y-0 left-0 z-50 w-72 flex flex-col transform transition-transform duration-300 ease-in-out border-r border-white/[0.06] ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ background: "#0D1017" }}
        aria-label="Navegação lateral"
        aria-hidden={!mobileOpen}
      >
        <div className="flex items-center justify-between px-4 py-5 border-b border-white/[0.06]">
          <Link href="/dashboard" prefetch={true} className="flex items-center gap-3 min-w-0" onClick={closeMobile}>
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0"
              style={{ background: "linear-gradient(135deg, #4f6df5, #6366f1)" }}
            >
              S
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-white leading-tight text-sm truncate">SaúdeSync</p>
              <p className="text-[10px] text-slate-500 truncate">Recepção virtual IA</p>
            </div>
          </Link>
          <button
            onClick={closeMobile}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
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
              <SidebarLink
                key={item.href}
                href={item.href}
                icon={item.icon}
                label={item.label}
                active={active}
                collapsed={false}
                onClick={closeMobile}
              />
            );
          })}
        </nav>

        <div className="p-2 border-t border-white/[0.06] space-y-0.5">
          <SidebarLink
            href="/perfil"
            icon="⚙"
            label="Perfil"
            active={pathname === "/perfil"}
            collapsed={false}
            onClick={closeMobile}
          />
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-400 hover:text-white hover:bg-white/[0.04] transition-all duration-150 min-h-[48px] border border-transparent"
          >
            <span className="w-5 text-center text-base shrink-0">⎋</span>
            <span className="truncate">Sair</span>
          </button>
        </div>
      </aside>

      <MobileMenuButton onClick={() => setMobileOpen(true)} />
    </>
  );
}

const Sidebar = memo(SidebarInner);

export default Sidebar;

function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="lg:hidden fixed top-4 left-4 z-40 p-2.5 rounded-xl text-white shadow-lg transition-colors min-w-[48px] min-h-[48px] flex items-center justify-center"
      style={{
        background: "rgba(13, 16, 23, 0.9)",
        border: "1px solid rgba(99, 102, 241, 0.2)",
        backdropFilter: "blur(12px)",
      }}
      aria-label="Abrir menu de navegação"
    >
      <span className="text-lg">☰</span>
    </button>
  );
}
