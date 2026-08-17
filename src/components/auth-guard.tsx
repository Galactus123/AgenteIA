"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Chaves de estado residuais de autenticação que podem ficar no localStorage.
const RESIDUAL_KEYS = ["auth_state", "auth_session", "session_state", "token", "saudesync_token"];

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (!data?.authenticated) {
          for (const key of RESIDUAL_KEYS) {
            try {
              localStorage.removeItem(key);
            } catch {
              // localStorage indisponível (ex.: modo privado) — ignora
            }
          }
          router.replace("/login");
        }
      })
      .catch(() => {
        if (!cancelled) router.replace("/login");
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  return <>{children}</>;
}
