import { logger } from "./lib/logger";
import { ExpoPushProvider, NoopPushProvider, notificationStore } from "./lib/notifications";
import { readServerEnvironment } from "./lib/config";

const environment = readServerEnvironment();

if (environment.SCHEDULER_ENABLED !== "true") {
  logger.warn("Scheduler is disabled; set SCHEDULER_ENABLED=true before starting the worker.");
  process.exit(0);
}

if (!environment.SUPABASE_URL || !environment.SUPABASE_SERVICE_ROLE_KEY) {
  logger.error("Scheduler cannot start without trusted Supabase configuration.");
  process.exit(1);
}

const provider = process.env.EXPO_ACCESS_TOKEN ? new ExpoPushProvider() : new NoopPushProvider();
const run = async () => {
  const results = notificationStore.runDue();
  const delivery = await notificationStore.flushQueued(provider);
  logger.info({ processed: results.length, delivery }, "Scheduled notification cycle complete");
};

void run();
const timer = setInterval(() => { void run(); }, environment.SCHEDULER_INTERVAL_SECONDS * 1000);

const shutdown = (signal: string) => {
  clearInterval(timer);
  logger.info({ signal }, "Scheduled notification worker stopped");
  process.exit(0);
};

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));