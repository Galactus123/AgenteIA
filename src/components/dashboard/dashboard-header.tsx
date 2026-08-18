"use client";

import Link from "next/link";

interface DashboardHeaderProps {
  userName?: string;
  clinicName?: string;
}

export default function DashboardHeader({ userName = "Admin", clinicName = "SaúdeSync" }: DashboardHeaderProps) {
  return (
    <header className="bg-white border border-slate-200 rounded-2xl px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between gap-3 sm:gap-4">
      <div className="flex items-center gap-3 flex-1 min-w-0 pl-10 lg:pl-0">
        <div className="relative flex-1 max-w-md">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
          <input
            type="text"
            placeholder="Buscar..."
            className="w-full pl-9 pr-3 py-2.5 sm:pr-4 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
            aria-label="Buscar paciente, médico ou consulta"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <button
          className="relative p-2.5 rounded-xl hover:bg-slate-100 transition-colors text-slate-500 hover:text-slate-700 min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="Notificações"
        >
          <span className="text-lg">🔔</span>
          <span className="absolute top-2 right-2 w-2 h-2 bg-danger rounded-full" aria-hidden="true"></span>
        </button>

        <div className="h-8 w-px bg-slate-200 hidden sm:block"></div>

        <Link
          href="/perfil"
          className="flex items-center gap-2 sm:gap-3 pl-2 pr-3 py-1.5 rounded-xl hover:bg-slate-50 transition-colors min-h-[44px]"
          aria-label="Perfil do usuário"
        >
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm shrink-0">
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="text-left hidden sm:block">
            <p className="text-sm font-medium text-slate-900 leading-tight">{userName}</p>
            <p className="text-xs text-slate-500">{clinicName}</p>
          </div>
        </Link>
      </div>
    </header>
  );
}
