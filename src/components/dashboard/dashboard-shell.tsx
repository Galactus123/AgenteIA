"use client";

import DashboardHeader from "@/components/dashboard/dashboard-header";

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-6 lg:px-8 pt-6 lg:pt-8 pb-4">
        <DashboardHeader />
      </div>
      <div className="flex-1 px-6 lg:px-8 pb-6 lg:pb-8 overflow-auto">{children}</div>
    </div>
  );
}
