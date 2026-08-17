import { runReminderCheck } from "@/lib/services/reminders";
import { runSubscriptionCycleCheck } from "@/lib/services/subscriptions";

const globalForScheduler = globalThis as unknown as { saudesyncScheduler?: NodeJS.Timeout };

const INTERVAL_MS = 60_000;

export function startReminderScheduler(): void {
  if (globalForScheduler.saudesyncScheduler) return;
  runReminderCheck();
  runSubscriptionCycleCheck();
  globalForScheduler.saudesyncScheduler = setInterval(() => {
    try {
      runReminderCheck();
    } catch {
      // mantém o agendador vivo mesmo em caso de erro pontual
    }
    try {
      runSubscriptionCycleCheck();
    } catch {
      // mantém o agendador vivo mesmo em caso de erro pontual
    }
  }, INTERVAL_MS);
}