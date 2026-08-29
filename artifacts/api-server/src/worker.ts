import { logger } from "./lib/logger";
import { ExpoPushProvider, NoopPushProvider } from "./lib/notifications";
import { SupabaseNotificationStore } from "./lib/durable-notifications";
import { readServerEnvironment } from "./lib/config";

const environment = readServerEnvironment();
const notificationStore = new SupabaseNotificationStore();

if (environment.SCHEDULER_ENABLED !== "true") {
  logger.warn("Scheduler is disabled; set SCHEDULER_ENABLED=true before starting the worker.");
  process.exit(0);
}

try {
  notificationStore.assertReliableWorkerStorage();
} catch (error) {
  logger.error(
    { persistence: notificationStore.persistenceDiagnostics(), error: error instanceof Error ? error.message : "notification_worker_storage_unavailable" },
    "Scheduler cannot start without a durable notification queue; local state is diagnostics-only",
  );
  process.exit(1);
}

const provider = process.env.EXPO_ACCESS_TOKEN ? new ExpoPushProvider() : new NoopPushProvider();
let running = false;
let lastMaintenanceAt = 0;
const run = async () => {
  if (running) {
    logger.warn("Scheduled notification cycle skipped because the previous cycle is still running");
    return;
  }
  running = true;
  try {
    const recovered = await notificationStore.recoverInterruptedWork();
    const results = await notificationStore.runDue();
    const delivery = await notificationStore.flushQueued(provider);
    let maintenance: unknown = null;
    const maintenanceIntervalMs = environment.SCHEDULER_MAINTENANCE_INTERVAL_SECONDS * 1000;
    if (Date.now() - lastMaintenanceAt >= maintenanceIntervalMs) {
      maintenance = await notificationStore.runMaintenance();
      lastMaintenanceAt = Date.now();
    }
    logger.info({ processed: results.length, recovered, delivery, maintenance }, "Scheduled worker cycle complete");
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : "scheduled_worker_cycle_failed" }, "Scheduled worker cycle failed");
  } finally {
    running = false;
  }
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