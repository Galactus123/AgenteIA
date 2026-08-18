"use client";

import DashboardHeader from "@/components/dashboard/dashboard-header";
import BottomNav from "@/components/dashboard/bottom-nav";

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-4 pt-4 pb-3 sm:px-6 sm:pt-6 lg:px-8 lg:pt-8">
        <DashboardHeader />
      </div>
      <div className="flex-1 px-4 pb-24 sm:px-6 sm:pb-24 lg:px-8 lg:pb-8 overflow-auto">
        {children}
      </div>
      <BottomNav />
    </div>
  );
}
