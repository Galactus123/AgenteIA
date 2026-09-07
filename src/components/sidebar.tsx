"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useCallback, memo } from "react";
import { useTheme } from "next-themes";
import type { SessionData } from "@/lib/auth";
import {
  LayoutDashboard,
  Calendar,
  MessageSquare,
  Users,
  Stethoscope,
  Tag,
  Building2,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronLeft,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  superAdminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} strokeWidth={1.75} /> },
  { href: "/consultas", label: "Consultas", icon: <Calendar size={18} strokeWidth={1.75} /> },
  { href: "/chat", label: "Atendimento IA", icon: <MessageSquare size={18} strokeWidth={1.75} />, superAdminOnly: true },
  { href: "/pacientes", label: "Pacientes", icon: <Users size={18} strokeWidth={1.75} /> },
  { href: "/medicos", label: "Médicos", icon: <Stethoscope size={18} strokeWidth={1.75} /> },
  { href: "/especialidades", label: "Especialidades", icon: <Tag size={18} strokeWidth={1.75} /> },
  { href: "/clinica", label: "Clínica", icon: <Building2 size={18} strokeWidth={1.75} /> },
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
  isDark,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
  collapsed: boolean;
  onClick?: () => void;
  isDark: boolean;
}) {
  return (
    <Link
      href={href}
      prefetch={true}
      title={collapsed ? label : undefined}
      onClick={onClick}
      className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
        active ? "" : "hover:opacity-80"
      }`}
      style={active ? {
        background: isDark
          ? "linear-gradient(135deg, rgba(79,109,245,0.15) 0%, rgba(129,140,248,0.08) 100%)"
          : "rgba(79, 109, 245, 0.08)",
        boxShadow: isDark ? "0 0 20px rgba(79,109,245,0.15), inset 0 1px 0 rgba(255,255,255,0.05)" : "none",
        border: isDark ? "1px solid rgba(99,102,241,0.2)" : "1px solid rgba(99,102,241,0.12)",
        color: "var(--color-primary)",
      } : {
        color: "var(--text-muted)",
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
      <span
        className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-150"
        style={active ? {
          background: isDark ? "rgba(79,109,245,0.18)" : "rgba(79,109,245,0.12)",
          boxShadow: isDark ? "0 0 10px rgba(79,109,245,0.25)" : "none",
        } : {}}
      >
        {icon}
      </span>
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
});

function SidebarInner({ session }: { session?: SessionData }) {
  const pathname = usePathname();
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

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

  const sidebarBg = mounted ? (isDark ? "#0D1017" : "#F8FAFC") : "#0D1017";
  const sidebarBorder = mounted ? (isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)") : "rgba(255,255,255,0.06)";

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:flex shrink-0 flex-col transition-all duration-300 ${
          collapsed ? "w-[72px]" : "w-60"
        }`}
        style={{ background: sidebarBg, borderRight: `1px solid ${sidebarBorder}` }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5" style={{ borderBottom: `1px solid ${sidebarBorder}` }}>
          <Link href="/dashboard" prefetch={true} className="flex items-center gap-3 min-w-0">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0"
              style={{ background: "linear-gradient(135deg, #4f6df5, #6366f1)" }}
            >
              S
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="font-semibold leading-tight text-sm truncate" style={{ color: "var(--text-primary)" }}>SaúdeSync</p>
                <p className="text-[10px] truncate" style={{ color: "var(--text-faint)" }}>Recepção virtual IA</p>
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
                isDark={isDark}
              />
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-2 space-y-0.5" style={{ borderTop: `1px solid ${sidebarBorder}` }}>
          <SidebarLink
            href="/perfil"
            icon={<Settings size={18} strokeWidth={1.75} />}
            label="Perfil"
            active={pathname === "/perfil"}
            collapsed={collapsed}
            isDark={isDark}
          />
          <button
            onClick={handleLogout}
            title={collapsed ? "Sair" : undefined}
            className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 hover:opacity-80 border border-transparent"
            style={{ color: "var(--text-muted)" }}
          >
            <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ color: "var(--text-muted)" }}>
              <LogOut size={18} strokeWidth={1.75} />
            </span>
            {!collapsed && <span className="truncate">Sair</span>}
          </button>
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="mx-2 mb-3 flex items-center justify-center gap-2 text-xs py-1.5 rounded-lg hover:opacity-80 transition-opacity"
          style={{ color: "var(--text-faint)" }}
          aria-label={collapsed ? "Expandir sidebar" : "Recolher sidebar"}
        >
          <ChevronLeft size={14} className={`transition-transform duration-300 ${collapsed ? "rotate-180" : ""}`} />
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
        className={`lg:hidden fixed inset-y-0 left-0 z-50 w-72 flex flex-col transform transition-transform duration-300 ease-in-out ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ background: sidebarBg, borderRight: `1px solid ${sidebarBorder}` }}
        aria-label="Navegação lateral"
        aria-hidden={!mobileOpen}
      >
        <div className="flex items-center justify-between px-4 py-5" style={{ borderBottom: `1px solid ${sidebarBorder}` }}>
          <Link href="/dashboard" prefetch={true} className="flex items-center gap-3 min-w-0" onClick={closeMobile}>
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0"
              style={{ background: "linear-gradient(135deg, #4f6df5, #6366f1)" }}
            >
              S
            </div>
            <div className="min-w-0">
              <p className="font-semibold leading-tight text-sm truncate" style={{ color: "var(--text-primary)" }}>SaúdeSync</p>
              <p className="text-[10px] truncate" style={{ color: "var(--text-faint)" }}>Recepção virtual IA</p>
            </div>
          </Link>
          <button
            onClick={closeMobile}
            className="p-2 rounded-lg transition-opacity hover:opacity-80"
            style={{ color: "var(--text-muted)" }}
            aria-label="Fechar menu"
          >
            <X size={18} />
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
                isDark={isDark}
              />
            );
          })}
        </nav>

        <div className="p-2 space-y-0.5" style={{ borderTop: `1px solid ${sidebarBorder}` }}>
          <SidebarLink
            href="/perfil"
            icon={<Settings size={18} strokeWidth={1.75} />}
            label="Perfil"
            active={pathname === "/perfil"}
            collapsed={false}
            onClick={closeMobile}
            isDark={isDark}
          />
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all duration-150 min-h-[48px] hover:opacity-80 border border-transparent"
            style={{ color: "var(--text-muted)" }}
          >
            <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ color: "var(--text-muted)" }}>
              <LogOut size={18} strokeWidth={1.75} />
            </span>
            <span className="truncate">Sair</span>
          </button>
        </div>
      </aside>

      <MobileMenuButton onClick={() => setMobileOpen(true)} isDark={isDark} mounted={mounted} />
    </>
  );
}

const Sidebar = memo(SidebarInner);

export default Sidebar;

function MobileMenuButton({ onClick, isDark, mounted }: { onClick: () => void; isDark: boolean; mounted: boolean }) {
  const bg = mounted ? (isDark ? "rgba(13, 16, 23, 0.9)" : "rgba(255,255,255,0.9)") : "rgba(13, 16, 23, 0.9)";
  const border = mounted ? (isDark ? "rgba(99, 102, 241, 0.2)" : "rgba(99, 102, 241, 0.15)") : "rgba(99, 102, 241, 0.2)";

  return (
    <button
      onClick={onClick}
      className="lg:hidden fixed top-4 left-4 z-40 p-2.5 rounded-xl text-white shadow-lg transition-opacity hover:opacity-80 min-w-[48px] min-h-[48px] flex items-center justify-center"
      style={{
        background: bg,
        border: `1px solid ${border}`,
        backdropFilter: "blur(12px)",
      }}
      aria-label="Abrir menu de navegação"
    >
      <Menu size={18} strokeWidth={1.75} />
    </button>
  );
}
