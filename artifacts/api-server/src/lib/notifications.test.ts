import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NotificationStore, type PushNotificationProvider } from "./notifications";

const event = (key: string) => ({
  eventId: `event-${key}`, idempotencyKey: key, userId: "user-1", type: "HUNT_STARTED" as const,
  category: "hunt" as const, variables: { huntTitle: "City Lights" }, deepLink: "worlds://hunt/demo",
});

const statePath = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), "notification-store-")), "state.json");
const readState = (file: string) => JSON.parse(fs.readFileSync(file, "utf8")) as {
  deliveries: Array<{ channel: string; status: string; attemptCount: number; lastAttemptAt: string | null }>;
  scheduled: Array<{ status: string; attempts: number; lastError: string | null }>;
};
const writeState = (file: string, state: unknown) => fs.writeFileSync(file, JSON.stringify(state), { mode: 0o600 });

describe("notification delivery", () => {
  it("keeps in-app history when push delivery fails", async () => {
    const store = new NotificationStore({ statePath: statePath() });
    const device = store.registerDevice({ userId: "user-1", installationId: `test-${Date.now()}`, token: "ExpoPushToken[test]", platform: "ios", appVersion: null });
    store.process(event(`fails-${Date.now()}`));
    const provider: PushNotificationProvider = {
      validateToken: async () => true, send: async () => { throw new Error("temporary outage"); },
      sendBatch: async () => [], healthCheck: async () => ({ configured: true, reachable: true }),
    };
    const result = await store.flushQueued(provider);
    assert.equal(store.list("user-1").length, 1);
    assert.equal(result.attempted, 1);
    assert.equal(store.deliveryRecords().find(item => item.deviceId === device.id)?.status, "queued");
  });

  it("disables a device after permanent token failure", async () => {
    const store = new NotificationStore({ statePath: statePath() });
    const device = store.registerDevice({ userId: "user-2", installationId: `invalid-${Date.now()}`, token: "bad-token", platform: "android", appVersion: null });
    store.process({ ...event(`invalid-${Date.now()}`), userId: "user-2" });
    const provider: PushNotificationProvider = {
      validateToken: async () => false, send: async () => ({}),
      sendBatch: async () => [], healthCheck: async () => ({ configured: true, reachable: true }),
    };
    await store.flushQueued(provider);
    const delivery = store.deliveryRecords().find(item => item.deviceId === device.id);
    assert.equal(delivery?.status, "failed");
    assert.equal(delivery?.failureCategory, "invalid_token");
    assert.equal(store.devicesFor("user-2").length, 0);
  });

  it("deduplicates an event before it creates a second delivery", () => {
    const store = new NotificationStore({ statePath: statePath() });
    const key = `same-${Date.now()}`;
    store.process(event(key));
    const created = store.process(event(key));
    assert.equal(created, null);
  });

  it("reloads and retries a stale sending delivery after restart", async () => {
    const file = statePath();
    const store = new NotificationStore({ statePath: file });
    const device = store.registerDevice({ userId: "user-1", installationId: "restart-delivery", token: "ExpoPushToken[restart]", platform: "ios", appVersion: null });
    store.process(event("restart-delivery"));
    const persisted = readState(file);
    const delivery = persisted.deliveries.find(item => item.channel === "push");
    assert.ok(delivery);
    delivery.status = "sending";
    delivery.attemptCount = 1;
    delivery.lastAttemptAt = new Date(Date.now() - 10_000).toISOString();
    writeState(file, persisted);

    const restarted = new NotificationStore({ statePath: file });
    assert.deepEqual(restarted.recoverInterruptedWork(new Date(), 1_000), { deliveriesRequeued: 1, deliveriesFailed: 0, scheduledRequeued: 0 });
    const provider: PushNotificationProvider = {
      validateToken: async () => true, send: async () => ({ providerMessageId: "accepted-after-restart" }),
      sendBatch: async () => [], healthCheck: async () => ({ configured: true, reachable: true }),
    };
    await restarted.flushQueued(provider);
    const recovered = restarted.deliveryRecords().find(item => item.deviceId === device.id);
    assert.equal(recovered?.status, "sent");
    assert.equal(recovered?.attemptCount, 2);
  });

  it("reclaims queued scheduled work after reload without duplicating its event", () => {
    const file = statePath();
    const store = new NotificationStore({ statePath: file });
    const scheduledEvent = event("restart-scheduled");
    store.schedule({ userId: "user-1", event: scheduledEvent, scheduledFor: new Date(Date.now() - 1_000).toISOString() });
    // Simulate a crash after process() persisted its idempotency key, but
    // before the worker persisted the scheduled job's terminal status.
    store.process(scheduledEvent);
    const persisted = readState(file);
    assert.equal(persisted.scheduled.length, 1);
    persisted.scheduled[0].status = "queued";
    persisted.scheduled[0].attempts = 1;
    writeState(file, persisted);

    const restarted = new NotificationStore({ statePath: file });
    assert.deepEqual(restarted.recoverInterruptedWork(), { deliveriesRequeued: 0, deliveriesFailed: 0, scheduledRequeued: 1 });
    const result = restarted.runDue();
    assert.equal(result.length, 1);
    assert.equal(result[0].notification, null);
    assert.equal(result[0].job.status, "suppressed");
    assert.equal(restarted.list("user-1").length, 1);
    assert.equal(new NotificationStore({ statePath: file }).list("user-1").length, 1);
  });
});