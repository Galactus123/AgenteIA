"use client";

import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error:", error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <div className="neon-card p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ background: "var(--neon-blue)" }}>
          <span className="text-3xl">⚠️</span>
        </div>
        <h2 className="text-lg font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
          Algo deu errado
        </h2>
        <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
          Ocorreu um erro inesperado. Tente novamente ou faça login novamente.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => reset()}
            className="neon-btn px-6 py-2.5 rounded-xl text-sm font-medium min-h-[44px]"
          >
            Tentar novamente
          </button>
          <a
            href="/login"
            className="px-6 py-2.5 rounded-xl text-sm font-medium min-h-[44px] flex items-center"
            style={{
              background: "var(--surface)",
              color: "var(--text-secondary)",
              border: "1px solid var(--surface-border)",
            }}
          >
            Ir para o login
          </a>
        </div>
        {error.digest && (
          <p className="text-xs mt-4" style={{ color: "var(--text-faint)" }}>
            Erro: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
