"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  superAdminOnly?: boolean;
}

const BOTTOM_NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "▦" },
  { href: "/consultas", label: "Consultas", icon: "🗓" },
  { href: "/chat", label: "Atend. IA", icon: "💬", superAdminOnly: true },
  { href: "/pacientes", label: "Pacientes", icon: "👥" },
  { href: "/medicos", label: "Médicos", icon: "🩺" },
  { href: "/clinica", label: "Clínica", icon: "🏥" },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-white border-t border-slate-200 safe-area-pb"
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
              className={`flex flex-col items-center justify-center gap-0.5 min-w-[48px] min-h-[48px] px-2 py-1 rounded-xl transition-colors ${
                active
                  ? "text-primary"
                  : "text-slate-400 active:text-slate-600"
              }`}
              aria-current={active ? "page" : undefined}
            >
              <span className="text-xl leading-none">{item.icon}</span>
              <span className="text-[10px] font-medium leading-tight">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
