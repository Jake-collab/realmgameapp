import { logger } from "./lib/logger";
import { ExpoPushProvider, NoopPushProvider } from "./lib/notifications";
import { SupabaseNotificationStore } from "./lib/durable-notifications";
import { readServerEnvironment } from "./lib/config";

const environment = readServerEnvironment();
const notificationStore = new SupabaseNotificationStore();

if (environment.SCHEDULER_ENABLED !== "true") {
  const message = "Scheduler is disabled; set SCHEDULER_ENABLED=true before starting the worker.";
  if (environment.NODE_ENV === "production") {
    logger.error({ event: "scheduled_worker_disabled", error: message }, message);
    process.exit(1);
  }
  logger.warn({ event: "scheduled_worker_disabled" }, message);
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
let cycleCount = 0;
let consecutiveCycleFailures = 0;
let totalCycleFailures = 0;
let cycleStartedAt: string | null = null;
let lastSuccessfulCycleAt: string | null = null;
let lastQueueHealth = null as Awaited<ReturnType<SupabaseNotificationStore["queueHealth"]>> | null;

logger.info(
  {
    event: "scheduled_worker_started",
    workerId: notificationStore.workerId,
    intervalSeconds: environment.SCHEDULER_INTERVAL_SECONDS,
    maintenanceIntervalSeconds: environment.SCHEDULER_MAINTENANCE_INTERVAL_SECONDS,
    pushProvider: provider instanceof ExpoPushProvider ? "expo" : "noop",
  },
  "Scheduled notification worker started",
);

const run = async () => {
  if (running) {
    logger.warn(
      { event: "scheduled_worker_cycle_skipped", cycleInProgress: true, cycleCount },
      "Scheduled notification cycle skipped because the previous cycle is still running",
    );
    return;
  }
  running = true;
  cycleCount++;
  const cycleNumber = cycleCount;
  cycleStartedAt = new Date().toISOString();
  try {
    const recovered = await notificationStore.recoverInterruptedWork();
    const results = await notificationStore.runDue();
    const delivery = await notificationStore.flushQueued(provider);
    let maintenance: unknown = null;
    const maintenanceIntervalMs = environment.SCHEDULER_MAINTENANCE_INTERVAL_SECONDS * 1000;
    if (Date.now() - lastMaintenanceAt >= maintenanceIntervalMs) {
      maintenance = await notificationStore.runMaintenance(environment.MODERATION_MEDIA_RETENTION_DAYS);
      lastMaintenanceAt = Date.now();
    }
    lastQueueHealth = await notificationStore.queueHealth();
    consecutiveCycleFailures = 0;
    lastSuccessfulCycleAt = new Date().toISOString();
    logger.info(
      {
        event: "scheduled_worker_cycle_complete",
        workerId: notificationStore.workerId,
        cycleNumber,
        processed: results.length,
        recovered,
        delivery,
        maintenance,
        queue: lastQueueHealth,
        consecutiveCycleFailures,
        totalCycleFailures,
        lastSuccessfulCycleAt,
      },
      "Scheduled worker cycle complete",
    );
  } catch (error) {
    consecutiveCycleFailures++;
    totalCycleFailures++;
    logger.error(
      {
        event: "scheduled_worker_cycle_failed",
        workerId: notificationStore.workerId,
        cycleNumber,
        consecutiveCycleFailures,
        totalCycleFailures,
        lastSuccessfulCycleAt,
        lastQueueHealth,
        error: error instanceof Error ? error.message : "scheduled_worker_cycle_failed",
      },
      "Scheduled worker cycle failed",
    );
  } finally {
    running = false;
    cycleStartedAt = null;
  }
};

void run();
const timer = setInterval(() => { void run(); }, environment.SCHEDULER_INTERVAL_SECONDS * 1000);
const heartbeatTimer = setInterval(() => {
  logger.info(
    {
      event: "scheduled_worker_heartbeat",
      workerId: notificationStore.workerId,
      cycleInProgress: running,
      cycleCount,
      cycleStartedAt,
      consecutiveCycleFailures,
      totalCycleFailures,
      lastSuccessfulCycleAt,
      lastQueueHealth,
    },
    "Scheduled notification worker heartbeat",
  );
}, environment.SCHEDULER_INTERVAL_SECONDS * 1000);

const shutdown = (signal: string) => {
  clearInterval(timer);
  clearInterval(heartbeatTimer);
  logger.info({ event: "scheduled_worker_stopped", signal, workerId: notificationStore.workerId }, "Scheduled notification worker stopped");
  process.exit(0);
};

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));