import { runReminderCheck } from "@/lib/services/reminders";
import { runSubscriptionCycleCheck } from "@/lib/services/subscriptions";

const globalForScheduler = globalThis as unknown as { saudesyncScheduler?: NodeJS.Timeout };

const INTERVAL_MS = 60_000;

function safe(task: () => Promise<unknown>, label: string): void {
  void task().catch((err) => {
    console.error(`[scheduler] Falha em ${label}:`, err);
  });
}

export function startReminderScheduler(): void {
  if (globalForScheduler.saudesyncScheduler) return;
  safe(runReminderCheck, "runReminderCheck");
  safe(runSubscriptionCycleCheck, "runSubscriptionCycleCheck");
  globalForScheduler.saudesyncScheduler = setInterval(() => {
    safe(runReminderCheck, "runReminderCheck");
    safe(runSubscriptionCycleCheck, "runSubscriptionCycleCheck");
  }, INTERVAL_MS);
}
