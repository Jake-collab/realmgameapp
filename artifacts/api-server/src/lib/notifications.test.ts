import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { NotificationStore, type PushNotificationProvider } from "./notifications";

const event = (key: string) => ({
  eventId: `event-${key}`, idempotencyKey: key, userId: "user-1", type: "HUNT_STARTED" as const,
  category: "hunt" as const, variables: { huntTitle: "City Lights" }, deepLink: "worlds://hunt/demo",
});

describe("notification delivery", () => {
  it("keeps in-app history when push delivery fails", async () => {
    const store = new NotificationStore();
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
    const store = new NotificationStore();
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
    const store = new NotificationStore();
    const key = `same-${Date.now()}`;
    store.process(event(key));
    const created = store.process(event(key));
    assert.equal(created, null);
  });
});