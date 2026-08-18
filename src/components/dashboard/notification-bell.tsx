"use client";

import { useEffect, useState, useCallback } from "react";

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
      className="relative p-2.5 rounded-xl hover:bg-slate-100 transition-colors text-slate-500 hover:text-slate-700 min-w-[44px] min-h-[44px] flex items-center justify-center"
      aria-label={`Notificações${unreadCount > 0 ? `, ${unreadCount} não lidas` : ""}`}
    >
      <span className="text-lg">🔔</span>
      {unreadCount > 0 && (
        <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] flex items-center justify-center bg-danger text-white text-[10px] font-bold rounded-full px-1">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </button>
  );
}
