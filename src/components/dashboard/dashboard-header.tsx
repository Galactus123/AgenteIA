"use client";

import { useState } from "react";
import Link from "next/link";
import NotificationBell from "@/components/dashboard/notification-bell";
import NotificationPanel from "@/components/dashboard/notification-panel";

interface DashboardHeaderProps {
  userName?: string;
  clinicName?: string;
}

export default function DashboardHeader({ userName = "Admin", clinicName = "SaúdeSync" }: DashboardHeaderProps) {
  const [panelOpen, setPanelOpen] = useState(false);

  return (
    <header
      className="rounded-2xl px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between gap-3 sm:gap-4"
      style={{
        background: "rgba(22, 25, 38, 0.8)",
        border: "1px solid rgba(99, 102, 241, 0.1)",
        backdropFilter: "blur(16px)",
      }}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0 pl-10 lg:pl-0">
        <div className="relative flex-1 max-w-md">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">🔍</span>
          <input
            type="text"
            placeholder="Buscar..."
            className="w-full pl-9 pr-3 py-2.5 sm:pr-4 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(99, 102, 241, 0.1)",
            }}
            aria-label="Buscar paciente, médico ou consulta"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <NotificationBell onToggle={() => setPanelOpen(!panelOpen)} />

        <div className="h-8 w-px hidden sm:block" style={{ background: "rgba(99, 102, 241, 0.1)" }}></div>

        <Link
          href="/perfil"
          className="flex items-center gap-2 sm:gap-3 pl-2 pr-3 py-1.5 rounded-xl hover:bg-white/[0.04] transition-colors min-h-[44px]"
          aria-label="Perfil do usuário"
        >
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-primary font-semibold text-sm shrink-0"
            style={{ background: "rgba(79,109,245,0.12)" }}
          >
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="text-left hidden sm:block">
            <p className="text-sm font-medium text-white leading-tight">{userName}</p>
            <p className="text-xs text-slate-500">{clinicName}</p>
          </div>
        </Link>
      </div>

      {panelOpen && <NotificationPanel onClose={() => setPanelOpen(false)} />}
    </header>
  );
}
