import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export type NotificationCategory = "quest" | "hunt" | "social" | "progress" | "moderation" | "account" | "system";
export type NotificationStatus = "scheduled" | "queued" | "sending" | "sent" | "delivered" | "failed" | "cancelled" | "suppressed";
export type PushPlatform = "ios" | "android" | "web";

export interface PushNotificationMessage {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface PushNotificationProvider {
  send(message: PushNotificationMessage): Promise<{ providerMessageId?: string }>;
  sendBatch(messages: PushNotificationMessage[]): Promise<Array<{ providerMessageId?: string; error?: string }>>;
  validateToken(token: string): Promise<boolean>;
  healthCheck(): Promise<{ configured: boolean; reachable: boolean }>;
}

/** Provider-neutral fallback. It never claims delivery succeeded. */
export class NoopPushProvider implements PushNotificationProvider {
  async send(_message: PushNotificationMessage): Promise<{ providerMessageId?: string }> { throw new Error("Push provider is not configured"); }
  async sendBatch(messages: PushNotificationMessage[]) { return messages.map(() => ({ error: "provider_not_configured" })); }
  async validateToken(_token: string) { return false; }
  async healthCheck() { return { configured: false, reachable: false }; }
}

/** Expo is intentionally isolated here; domain code only sees the provider contract. */
export class ExpoPushProvider implements PushNotificationProvider {
  constructor(private readonly accessToken: string | undefined = process.env.EXPO_ACCESS_TOKEN) {}
  private get configured() { return Boolean(this.accessToken); }
  async send(message: PushNotificationMessage) {
    if (!this.configured) throw new Error("Expo push provider is not configured");
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST", headers: { "content-type": "application/json", ...(this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {}) },
      body: JSON.stringify({ to: message.token, title: message.title, body: message.body, data: message.data }),
    });
    if (!response.ok) throw new Error(`Expo push request failed (${response.status})`);
    const json = await response.json() as { data?: { id?: string } };
    return { providerMessageId: json.data?.id };
  }
  async sendBatch(messages: PushNotificationMessage[]) {
    const results: Array<{ providerMessageId?: string; error?: string }> = [];
    for (const message of messages) { try { results.push(await this.send(message)); } catch (error) { results.push({ error: error instanceof Error ? error.message : "push_failed" }); } }
    return results;
  }
  async validateToken(token: string) { return /^Expo(nent)?PushToken\[.+\]$/.test(token); }
  async healthCheck() { return { configured: this.configured, reachable: false }; }
}

export interface NotificationEvent {
  eventId: string;
  idempotencyKey: string;
  userId: string;
  type: string;
  category: NotificationCategory;
  variables?: Record<string, string | number>;
  target?: { type: string; id?: string };
  deepLink?: string;
  urgent?: boolean;
  occurredAt?: string;
}

export interface NotificationRecord {
  id: string;
  userId: string;
  type: string;
  category: NotificationCategory;
  title: string;
  body: string;
  deepLink: string | null;
  targetType: string | null;
  targetId: string | null;
  domainEventId: string;
  createdAt: string;
  readAt: string | null;
  archivedAt: string | null;
  metadata: Record<string, string | number>;
}

export interface NotificationDeliveryRecord {
  id: string;
  notificationId: string;
  channel: "in_app" | "push";
  deviceId: string | null;
  status: NotificationStatus;
  attemptCount: number;
  providerMessageId: string | null;
  failureCategory: string | null;
  lastAttemptAt: string | null;
  createdAt: string;
}

export interface ScheduledNotification {
  id: string;
  userId: string;
  event: NotificationEvent;
  scheduledFor: string;
  status: "scheduled" | "queued" | "sent" | "cancelled" | "suppressed" | "failed";
  attempts: number;
  lastError: string | null;
}

export interface PushDevice {
  id: string;
  userId: string;
  installationId: string;
  token: string;
  platform: PushPlatform;
  appVersion: string | null;
  enabled: boolean;
  invalidatedAt: string | null;
  lastUsedAt: string;
}

export interface NotificationPreferences {
  pushEnabled: boolean;
  questEnabled: boolean;
  huntEnabled: boolean;
  progressEnabled: boolean;
  socialEnabled: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  timezone: string;
  showDetails: boolean;
}

const COPY: Record<string, { title: string; body: (v: Record<string, string | number>) => string }> = {
  DAILY_QUEST_READY: { title: "Your Daily Quest is ready", body: v => String(v.questTitle ?? "A new adventure is waiting.") },
  MONTHLY_DROP_LIVE: { title: "The new Monthly Quest Drop is live", body: v => String(v.questTitle ?? "Explore the latest Quest collection.") },
  HUNT_INVITATION: { title: "You've been invited to a Hunt", body: v => `${v.hostName ? `${v.hostName} invited you to ` : ""}${v.huntTitle ?? "a Hunt"}` },
  HUNT_STARTING_SOON: { title: "Your Hunt starts soon", body: v => `${v.huntTitle ?? "Your Hunt"} is starting soon.` },
  HUNT_STARTED: { title: "Your Hunt has started", body: v => String(v.huntTitle ?? "Open the Hunt map to begin.") },
  HUNT_PAUSED: { title: "This Hunt has been paused", body: v => String(v.huntTitle ?? "The host paused this Hunt.") },
  HUNT_RESUMED: { title: "This Hunt has resumed", body: v => String(v.huntTitle ?? "You can continue exploring.") },
  HUNT_CANCELLED: { title: "This Hunt was cancelled", body: v => `${v.huntTitle ?? "The Hunt"} is no longer available.` },
  HUNT_RESULTS_READY: { title: "Hunt results are ready", body: v => String(v.huntTitle ?? "See how your Hunt went.") },
  PROOF_APPROVED: { title: "Quest approved", body: v => v.points == null ? String(v.questTitle ?? "Your proof was approved.") : `${v.questTitle ?? "Your Quest"} — you earned ${v.points} points` },
  PROOF_NEEDS_RESUBMISSION: { title: "Your Quest proof needs an update", body: v => String(v.reason ?? "Review the safe feedback and resubmit your proof.") },
  PROOF_REJECTED: { title: "Your Quest proof was not approved", body: v => String(v.reason ?? "Review the result in Worlds.") },
  POINTS_QUARANTINED: { title: "Your Quest points are under review", body: v => String(v.questTitle ?? "Your points are temporarily unavailable while we review this activity.") },
  POINTS_RELEASED: { title: "Your points are now available", body: v => String(v.points == null ? "Your reviewed points are available." : `${v.points} points are now available.`) },
  ACHIEVEMENT_UNLOCKED: { title: "Achievement unlocked", body: v => String(v.achievementName ?? "You reached a new milestone.") },
  FRIEND_REQUEST: { title: "New friend request", body: v => `${v.displayName ?? "Someone"} wants to connect.` },
  FRIEND_ACCEPTED: { title: "Friend request accepted", body: v => `${v.displayName ?? "A friend"} accepted your request.` },
  REPORT_ACKNOWLEDGED: { title: "Thanks for your report", body: () => "We received your report and will review it." },
  ACCOUNT_SECURITY: { title: "Security update", body: v => String(v.message ?? "There is an important update for your account.") },
};

const categoryFor = (type: string): NotificationCategory =>
  type.startsWith("HUNT_") ? "hunt" :
  type.startsWith("DAILY_") || type.startsWith("MONTHLY_") || type.startsWith("PROOF_") || type.startsWith("POINTS_") ? "quest" :
  type.startsWith("ACHIEVEMENT_") ? "progress" :
  type.startsWith("FRIEND_") ? "social" :
  type.startsWith("REPORT_") ? "moderation" :
  type.startsWith("ACCOUNT_") ? "account" : "system";

export function renderNotification(event: NotificationEvent): NotificationRecord {
  const copy = COPY[event.type] ?? { title: "You have an update in Worlds", body: () => "Open Worlds to see what changed." };
  const vars = event.variables ?? {};
  return {
    id: randomUUID(), userId: event.userId, type: event.type, category: event.category || categoryFor(event.type),
    title: copy.title.slice(0, 100), body: copy.body(vars).slice(0, 500),
    deepLink: event.deepLink ?? null, targetType: event.target?.type ?? null, targetId: event.target?.id ?? null,
    domainEventId: event.eventId, createdAt: event.occurredAt ?? new Date().toISOString(), readAt: null, archivedAt: null,
    metadata: Object.fromEntries(Object.entries(vars).filter(([key]) => !/token|secret|answer|coordinate|lat|lng|score|confidence|reporter/i.test(key))),
  };
}

export function isInQuietHours(now: Date, preferences: Pick<NotificationPreferences, "quietHoursEnabled" | "quietHoursStart" | "quietHoursEnd" | "timezone">): boolean {
  if (!preferences.quietHoursEnabled) return false;
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: preferences.timezone, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(now);
  const current = Number(parts.find(p => p.type === "hour")?.value ?? 0) * 60 + Number(parts.find(p => p.type === "minute")?.value ?? 0);
  const parse = (value: string) => { const [h, m] = value.split(":").map(Number); return h * 60 + m; };
  const start = parse(preferences.quietHoursStart), end = parse(preferences.quietHoursEnd);
  return start === end ? true : start < end ? current >= start && current < end : current >= start || current < end;
}

export class NotificationStore {
  private notifications = new Map<string, NotificationRecord>();
  private idempotency = new Set<string>();
  private devices = new Map<string, PushDevice>();
  private preferences = new Map<string, NotificationPreferences>();
  private deliveries = new Map<string, NotificationDeliveryRecord>();
  private scheduled = new Map<string, ScheduledNotification>();
  private readonly statePath = process.env.NOTIFICATION_LOCAL_STATE_PATH ?? path.join(process.cwd(), ".local", "notifications-state.json");
  private readonly localPersistence = process.env.NODE_ENV !== "production" || Boolean(process.env.NOTIFICATION_LOCAL_STATE_PATH);

  constructor() {
    if (!this.localPersistence) return;
    try {
      const raw = JSON.parse(fs.readFileSync(this.statePath, "utf8")) as {
        notifications?: NotificationRecord[]; idempotency?: string[]; preferences?: Array<[string, NotificationPreferences]>;
        deliveries?: NotificationDeliveryRecord[]; scheduled?: ScheduledNotification[];
      };
      raw.notifications?.forEach(item => this.notifications.set(item.id, item));
      raw.idempotency?.forEach(item => this.idempotency.add(item));
      raw.preferences?.forEach(([userId, preferences]) => this.preferences.set(userId, preferences));
      raw.deliveries?.forEach(item => this.deliveries.set(item.id, item));
      raw.scheduled?.forEach(item => this.scheduled.set(item.id, item));
    } catch { /* first run or an incomplete local file */ }
  }
  private persist() {
    if (!this.localPersistence) return;
    try {
      fs.mkdirSync(path.dirname(this.statePath), { recursive: true });
      const temporary = `${this.statePath}.${process.pid}.tmp`;
      fs.writeFileSync(temporary, JSON.stringify({
        notifications: this.all().slice(-2000), idempotency: [...this.idempotency].slice(-5000),
        preferences: [...this.preferences.entries()], deliveries: [...this.deliveries.values()].slice(-5000),
        scheduled: [...this.scheduled.values()].slice(-2000),
      }, null, 2), { mode: 0o600 });
      fs.renameSync(temporary, this.statePath);
    } catch { /* local diagnostics must not bring down the API */ }
  }

  process(event: NotificationEvent): NotificationRecord | null {
    if (this.idempotency.has(event.idempotencyKey)) return null;
    this.idempotency.add(event.idempotencyKey);
    const record = renderNotification({ ...event, category: event.category ?? categoryFor(event.type) });
    this.notifications.set(record.id, record);
    this.deliveries.set(`${record.id}:in_app`, { id: randomUUID(), notificationId: record.id, channel: "in_app", deviceId: null, status: "delivered", attemptCount: 1, providerMessageId: null, failureCategory: null, lastAttemptAt: record.createdAt, createdAt: record.createdAt });
    const preferences = this.getPreferences(event.userId);
    const categoryEnabled = record.category === "quest" ? preferences.questEnabled : record.category === "hunt" ? preferences.huntEnabled : record.category === "social" ? preferences.socialEnabled : record.category === "progress" ? preferences.progressEnabled : true;
    for (const device of this.devicesFor(event.userId)) {
      const suppressed = !preferences.pushEnabled || !categoryEnabled || (!event.urgent && isInQuietHours(new Date(record.createdAt), preferences));
      this.deliveries.set(`${record.id}:${device.id}`, { id: randomUUID(), notificationId: record.id, channel: "push", deviceId: device.id, status: suppressed ? "suppressed" : "queued", attemptCount: 0, providerMessageId: null, failureCategory: suppressed ? "preference_or_quiet_hours" : null, lastAttemptAt: null, createdAt: record.createdAt });
    }
    this.persist();
    return record;
  }
  list(userId: string) { return [...this.notifications.values()].filter(n => n.userId === userId && !n.archivedAt).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }
  all() { return [...this.notifications.values()]; }
  unread(userId: string) { return this.list(userId).filter(n => !n.readAt).length; }
  markRead(userId: string, id: string) { const n = this.notifications.get(id); if (n?.userId === userId) { n.readAt = new Date().toISOString(); this.persist(); } return n ?? null; }
  markAllRead(userId: string) { this.list(userId).filter(n => !n.readAt).forEach(n => { n.readAt = new Date().toISOString(); }); this.persist(); }
  registerDevice(input: Omit<PushDevice, "id" | "enabled" | "invalidatedAt" | "lastUsedAt">) {
    const existing = [...this.devices.values()].find(d => d.userId === input.userId && d.installationId === input.installationId);
    const device = { ...(existing ?? { id: randomUUID(), enabled: true, invalidatedAt: null, lastUsedAt: "" }), ...input, enabled: true, invalidatedAt: null, lastUsedAt: new Date().toISOString() };
    this.devices.set(device.id, device); this.persist(); return device;
  }
  unregisterDevice(userId: string, installationId: string) { for (const device of this.devices.values()) if (device.userId === userId && device.installationId === installationId) device.enabled = false; this.persist(); }
  getPreferences(userId: string): NotificationPreferences { return this.preferences.get(userId) ?? { pushEnabled: true, questEnabled: true, huntEnabled: true, progressEnabled: true, socialEnabled: true, quietHoursEnabled: false, quietHoursStart: "22:00", quietHoursEnd: "07:00", timezone: "UTC", showDetails: true }; }
  setPreferences(userId: string, patch: Partial<NotificationPreferences>) { const value = { ...this.getPreferences(userId), ...patch }; this.preferences.set(userId, value); this.persist(); return value; }
  devicesFor(userId: string) { return [...this.devices.values()].filter(d => d.userId === userId && d.enabled); }
  deliveryRecords() { return [...this.deliveries.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }
  schedule(input: Omit<ScheduledNotification, "id" | "status" | "attempts" | "lastError">) {
    const existing = [...this.scheduled.values()].find(item => item.event.idempotencyKey === input.event.idempotencyKey);
    if (existing) return existing;
    const job: ScheduledNotification = { ...input, id: randomUUID(), status: "scheduled", attempts: 0, lastError: null };
    this.scheduled.set(job.id, job); this.persist(); return job;
  }
  due(now = new Date()) { return [...this.scheduled.values()].filter(job => job.status === "scheduled" && new Date(job.scheduledFor) <= now); }
  runDue(now = new Date()) {
    const results = this.due(now).map(job => {
      job.status = "queued"; job.attempts += 1;
      const result = this.process(job.event);
      job.status = result ? "sent" : "sent";
      return { job, notification: result };
    });
    this.persist(); return results;
  }
}

export const notificationStore = new NotificationStore();