import { runReminderCheck } from "@/lib/services/reminders";
import { runSubscriptionCycleCheck } from "@/lib/services/subscriptions";
import { processOutbox } from "@/lib/services/outbox";

const globalForScheduler = globalThis as unknown as { saudesyncScheduler?: NodeJS.Timeout };

const INTERVAL_MS = 60_000;

// Em producao (Vercel/serverless) o agendamento e do pg_cron do
// Supabase (migrations 20261002000004) + vercel.json; o setInterval
// nao sobrevive ao ciclo do serverless e fica apenas como fallback
// em dev (next dev).
const IS_PRODUCTION = Boolean(process.env.VERCEL) || process.env.NODE_ENV === "production";

function safe(task: () => Promise<unknown>, label: string): void {
  void task().catch((err) => {
    console.error(`[scheduler] Falha em ${label}:`, err);
  });
}

function tick(): void {
  safe(runReminderCheck, "runReminderCheck");
  safe(runSubscriptionCycleCheck, "runSubscriptionCycleCheck");
  safe(processOutbox, "processOutbox");
}

export function startReminderScheduler(): void {
  if (IS_PRODUCTION) {
    console.log(
      "[scheduler] Producao detectada: setInterval desativado (agendamento via pg_cron do Supabase + vercel.json)."
    );
    return;
  }
  if (globalForScheduler.saudesyncScheduler) return;
  tick();
  globalForScheduler.saudesyncScheduler = setInterval(tick, INTERVAL_MS);
}
