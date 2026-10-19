"use client";

import { useState } from "react";
import Link from "next/link";
import NotificationBell from "@/components/dashboard/notification-bell";
import NotificationPanel from "@/components/dashboard/notification-panel";
import ThemeToggle from "@/components/theme-toggle";
import GlobalSearch from "@/components/dashboard/global-search";
import ClinicSwitcher from "@/components/dashboard/clinic-switcher";

interface DashboardHeaderProps {
  userName?: string;
  // Nome da clínica usado só como fallback até o seletor carregar a lista.
  clinicName?: string;
}

export default function DashboardHeader({ userName = "Admin", clinicName = "SaúdeSync" }: DashboardHeaderProps) {
  const [panelOpen, setPanelOpen] = useState(false);

  return (
    <header
      className="relative z-50 rounded-2xl px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between gap-3 sm:gap-4"
      style={{
        background: "var(--card)",
        border: "1px solid var(--card-border)",
        backdropFilter: "blur(16px)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0 pl-10 lg:pl-0">
        <GlobalSearch />
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <ThemeToggle />

        <NotificationBell onToggle={() => setPanelOpen(!panelOpen)} />

        <div className="h-8 w-px hidden sm:block" style={{ background: "var(--surface-border)" }}></div>

        {/* Multi-clínica: nome REAL da clínica ativa + troca (em telas
            pequenas o acesso fica em Minhas Clínicas, no menu lateral). */}
        <ClinicSwitcher fallbackName={clinicName} className="hidden sm:block" />

        <Link
          href="/perfil"
          className="flex items-center gap-2 sm:gap-3 pl-2 pr-3 py-1.5 rounded-xl hover:opacity-80 transition-opacity min-h-[44px]"
          aria-label="Perfil do usuário"
        >
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-primary font-semibold text-sm shrink-0"
            style={{ background: "var(--neon-blue)" }}
          >
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="text-left hidden sm:block">
            <p className="text-sm font-medium leading-tight dark:text-white text-slate-900" style={{ color: "var(--text-primary)" }}>{userName}</p>
          </div>
        </Link>
      </div>

      {panelOpen && <NotificationPanel onClose={() => setPanelOpen(false)} />}
    </header>
  );
}
