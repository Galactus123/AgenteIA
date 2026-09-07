"use client";

import { useEffect, useState, useCallback } from "react";
import { Bell } from "lucide-react";

interface NotificationBellProps {
  onToggle: () => void;
}

export default function NotificationBell({ onToggle }: NotificationBellProps) {
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchCount = useCallback(() => {
    fetch("/api/notifications?unread=1")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setUnreadCount(data.unreadCount);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 30_000);
    return () => clearInterval(interval);
  }, [fetchCount]);

  return (
    <button
      onClick={onToggle}
      className="relative p-2.5 rounded-xl hover:opacity-80 transition-opacity min-w-[44px] min-h-[44px] flex items-center justify-center dark:text-slate-400 text-slate-500"
      style={{
        background: unreadCount > 0 ? "rgba(79,109,245,0.08)" : "transparent",
      }}
      aria-label={`Notificações${unreadCount > 0 ? `, ${unreadCount} não lidas` : ""}`}
    >
      <Bell size={20} strokeWidth={1.75} />
      {unreadCount > 0 && (
        <span
          className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] flex items-center justify-center text-white text-[10px] font-bold rounded-full px-1"
          style={{
            background: "linear-gradient(135deg, #ef4444, #dc2626)",
            boxShadow: "0 0 8px rgba(239,68,68,0.5)",
          }}
        >
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </button>
  );
}
