// ── Monitoramento — Captura de Excecoes ───────────────────────────────
// Handler global para excecoes nao capturadas e rejeicoes de promise.
// Em producao, integra com Sentry (se configurado).

export interface ErrorContext {
  phase: string;
  conversationId?: number;
  phone?: string;
  additional?: Record<string, unknown>;
}

/**
 * Inicializa o monitoramento global de erros.
 * Deve ser chamada uma vez no startup da aplicacao.
 */
export function initErrorMonitoring(): void {
  // Excecoes nao capturadas
  process.on("uncaughtException", (error: Error) => {
    console.error("[monitor] Uncaught Exception:", error.message);
    console.error("[monitor] Stack:", error.stack);
    reportError(error, { phase: "uncaughtException" });
  });

  // Rejeicoes de promise nao tratadas
  process.on("unhandledRejection", (reason: unknown) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    console.error("[monitor] Unhandled Rejection:", error.message);
    reportError(error, { phase: "unhandledRejection" });
  });

  console.log("[monitor] Error monitoring inicializado");
}

/**
 * Reporta um erro para o servico de monitoramento configurado.
 * Atualmente apenas loga — integrar com Sentry em producao.
 */
export function reportError(error: Error, context?: ErrorContext): void {
  const errorReport = {
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
    phase: context?.phase ?? "unknown",
    conversationId: context?.conversationId,
    // Nunca logar phone ou dados sensiveis
    ...context?.additional,
  };

  console.error("[monitor] Error report:", JSON.stringify(errorReport));

  // Sentry integration (quando configurado)
  if (process.env.SENTRY_DSN) {
    // Sentry.captureException(error, { extra: context });
    console.log("[monitor] Sentry DSN configurado — integracao pendente");
  }
}

/**
 * Captura um erro de forma segura, sem interromper o fluxo.
 */
export function safeCatch<T>(fn: () => T, fallback: T, context?: string): T {
  try {
    return fn();
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    reportError(error, { phase: context ?? "safeCatch" });
    return fallback;
  }
}

/**
 * Captura uma operacao async de forma segura.
 */
export async function safeCatchAsync<T>(
  fn: () => Promise<T>,
  fallback: T,
  context?: string
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    reportError(error, { phase: context ?? "safeCatchAsync" });
    return fallback;
  }
}
