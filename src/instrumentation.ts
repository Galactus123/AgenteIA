export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Monitoramento global de erros
    const { initErrorMonitoring } = await import("@/lib/monitoring");
    initErrorMonitoring();

    // Scheduler de lembretes/ciclo/fila — ativo so em dev;
    // em producao quem agenda e o pg_cron do Supabase + vercel.json.
    const { startReminderScheduler } = await import("@/lib/services/reminder-scheduler");
    startReminderScheduler();

    // Politicas de retencao LGPD (executa uma vez no startup)
    const { runRetentionPolicies } = await import("@/lib/lgpd");
    try {
      const results = await runRetentionPolicies();
      const total = results.reduce((acc, r) => acc + r.deleted + r.anonymized, 0);
      if (total > 0) {
        console.log("[lgpd] Retencao executada:", results);
      }
    } catch (err) {
      console.error("[lgpd] Erro ao executar politicas de retencao:", err);
    }
  }
}
