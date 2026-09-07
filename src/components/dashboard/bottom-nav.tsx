"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Calendar,
  MessageSquare,
  Users,
  Stethoscope,
  Building2,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  superAdminOnly?: boolean;
}

const BOTTOM_NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: <LayoutDashboard size={20} strokeWidth={1.75} /> },
  { href: "/consultas", label: "Consultas", icon: <Calendar size={20} strokeWidth={1.75} /> },
  { href: "/chat", label: "Atend. IA", icon: <MessageSquare size={20} strokeWidth={1.75} />, superAdminOnly: true },
  { href: "/pacientes", label: "Pacientes", icon: <Users size={20} strokeWidth={1.75} /> },
  { href: "/medicos", label: "Médicos", icon: <Stethoscope size={20} strokeWidth={1.75} /> },
  { href: "/clinica", label: "Clínica", icon: <Building2 size={20} strokeWidth={1.75} /> },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-50 safe-area-pb"
      style={{
        background: "var(--card)",
        borderTop: "1px solid var(--card-border)",
        backdropFilter: "blur(16px)",
      }}
      role="navigation"
      aria-label="Navegação principal"
    >
      <div className="flex items-center justify-around h-16 px-2">
        {BOTTOM_NAV_ITEMS.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              className={`flex flex-col items-center justify-center gap-1 min-w-[48px] min-h-[48px] px-2 py-1 rounded-xl transition-all duration-150 ${
                active ? "" : "opacity-60 active:opacity-100 dark:text-slate-500 text-slate-400"
              }`}
              style={active ? {
                color: "var(--color-primary)",
                background: "rgba(79,109,245,0.1)",
              } : undefined}
              aria-current={active ? "page" : undefined}
            >
              <span className="leading-none">{item.icon}</span>
              <span className="text-[10px] font-medium leading-tight">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
