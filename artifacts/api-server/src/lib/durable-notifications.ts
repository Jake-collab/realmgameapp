import { randomUUID } from "node:crypto";
import {
  renderNotification,
  type NotificationEvent,
  type NotificationRecord,
  type NotificationStatus,
  type PushNotificationProvider,
  type NotificationCategory,
} from "./notifications";
import {
  deleteSupabaseStorageObject,
  supabaseAdminConfigured,
  supabaseAdminRequest,
  supabaseAdminRpc,
  type SupabaseStorageDeleteResult,
} from "./supabase-admin";

type JsonObject = Record<string, unknown>;

type ClaimedEvent = {
  id: string;
  event_id: string;
  idempotency_key: string;
  event_type: string;
  user_id: string;
  payload: JsonObject;
  attempt_count: number;
  lease_token: string;
};

type ClaimedScheduled = {
  id: string;
  user_id: string;
  notification_type: string;
  payload: JsonObject;
  scheduled_for: string;
  attempts: number;
  idempotency_key: string;
  lease_token: string;
};

type ClaimedDelivery = {
  id: string;
  notification_id: string;
  device_id: string | null;
  token: string | null;
  title: string;
  body: string;
  deep_link: string | null;
  attempt_count: number;
  lease_token: string;
};

type ModerationRetentionCandidate = {
  media_id: string;
  bucket: string;
  storage_path: string;
  reason: string;
};

type ClaimedModerationRetentionCandidate = {
  media_id: string;
  bucket: string;
  storage_path: string;
  lease_token: string;
  attempt_count: number;
};

type ModerationRetentionSummary = {
  candidates: number;
  claimed: number;
  deleted: number;
  missing: number;
  failed: number;
  skipped: number;
  errors: Array<{ mediaId: string; error: string }>;
};

const MAX_EVENT_ATTEMPTS = 5;
const MAX_DELIVERY_ATTEMPTS = 3;
const LEASE_SECONDS = 300;
const DEFAULT_MODERATION_MEDIA_RETENTION_DAYS = 30;
const RETENTION_RETRY_DELAY_MINUTES = 15;

function categoryFor(type: string): NotificationCategory {
  return type.startsWith("HUNT_") ? "hunt" :
    type.startsWith("DAILY_") || type.startsWith("MONTHLY_") || type.startsWith("PROOF_") || type.startsWith("POINTS_") ? "quest" :
    type.startsWith("ACHIEVEMENT_") ? "progress" :
    type.startsWith("FRIEND_") ? "social" :
    type.startsWith("REPORT_") ? "moderation" :
    type.startsWith("ACCOUNT_") ? "account" : "system";
}

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asCategory(value: unknown, type: string): NotificationCategory {
  return value === "quest" || value === "hunt" || value === "social" || value === "progress"
    || value === "moderation" || value === "account" || value === "system"
    ? value
    : categoryFor(type);
}

function eventFromClaim(row: ClaimedEvent | ClaimedScheduled): NotificationEvent {
  const payload = asObject(row.payload);
  const type = "event_type" in row ? row.event_type : row.notification_type;
  const eventId = "event_id" in row ? row.event_id : row.id;
  return {
    eventId,
    idempotencyKey: row.idempotency_key,
    userId: row.user_id,
    type,
    category: asCategory(payload.category, type),
    variables: asObject(payload.variables) as Record<string, string | number>,
    target: asObject(payload.target) as { type: string; id?: string },
    deepLink: asString(payload.deepLink),
    urgent: payload.urgent === true,
    occurredAt: asString(payload.occurredAt),
  };
}

function retryAt(attempt: number): string {
  const seconds = Math.min(15 * 60, 15 * 2 ** Math.max(0, attempt - 1));
  return new Date(Date.now() + seconds * 1000).toISOString();
}

function notificationFromRendered(
  rendered: NotificationRecord,
  id: string,
): NotificationRecord {
  return { ...rendered, id };
}

export class SupabaseNotificationStore {
  private readonly workerId = randomUUID();

  persistenceDiagnostics() {
    return {
      mode: "supabase" as const,
      restartRecoveryAvailable: true,
      productionDurability: "configured" as const,
    };
  }

  canRunReliableWorker() {
    return supabaseAdminConfigured();
  }

  assertReliableWorkerStorage() {
    if (!this.canRunReliableWorker()) {
      throw new Error("Reliable notification worker requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
    }
  }

  async process(event: NotificationEvent): Promise<NotificationRecord | null> {
    this.assertReliableWorkerStorage();
    await supabaseAdminRpc("enqueue_notification_event", {
      p_event_id: event.eventId,
      p_idempotency_key: event.idempotencyKey,
      p_event_type: event.type,
      p_user_id: event.userId,
      p_payload: {
        category: event.category,
        variables: event.variables ?? {},
        target: event.target ?? null,
        deepLink: event.deepLink ?? null,
        urgent: event.urgent ?? false,
        occurredAt: event.occurredAt ?? null,
      },
    });
    await this.runDue();
    return this.getByIdempotency(event.idempotencyKey);
  }

  async all(): Promise<NotificationRecord[]> {
    const rows = await supabaseAdminRequest<Array<JsonObject>>(
      "notifications?select=id,user_id,type,title,body,deep_link,target_type,target_id,domain_event_id,idempotency_key,created_at,read_at,archived_at,metadata&order=created_at.desc&limit=2000",
    );
    return rows.map(row => this.mapNotification(row));
  }

  async deliveryRecords(): Promise<Array<{
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
  }>> {
    const rows = await supabaseAdminRequest<Array<JsonObject>>(
      "notification_deliveries?select=id,notification_id,channel,device_id,status,attempt_count,provider_message_id,failure_category,last_attempt_at,created_at&order=created_at.desc&limit=5000",
    );
    return rows.map(row => ({
      id: String(row.id),
      notificationId: String(row.notification_id),
      channel: row.channel === "in_app" ? "in_app" : "push",
      deviceId: row.device_id ? String(row.device_id) : null,
      status: String(row.status) as NotificationStatus,
      attemptCount: Number(row.attempt_count ?? 0),
      providerMessageId: row.provider_message_id ? String(row.provider_message_id) : null,
      failureCategory: row.failure_category ? String(row.failure_category) : null,
      lastAttemptAt: row.last_attempt_at ? String(row.last_attempt_at) : null,
      createdAt: String(row.created_at),
    }));
  }

  async scheduledCount(): Promise<number> {
    const rows = await supabaseAdminRequest<Array<{ id: string }>>(
      "scheduled_notifications?select=id&status=eq.scheduled&limit=2000",
    );
    return rows.length;
  }

  async queuedDeliveryCount(): Promise<number> {
    const rows = await supabaseAdminRequest<Array<{ id: string }>>(
      "notification_deliveries?select=id&channel=eq.push&status=eq.queued&limit=2000",
    );
    return rows.length;
  }

  async runDue(): Promise<Array<{ job: { id: string; status: string }; notification: NotificationRecord | null }>> {
    this.assertReliableWorkerStorage();
    const results: Array<{ job: { id: string; status: string }; notification: NotificationRecord | null }> = [];
    const events = await supabaseAdminRpc<ClaimedEvent[]>("claim_notification_events", {
      p_worker_id: this.workerId,
      p_limit: 100,
      p_lease_seconds: LEASE_SECONDS,
      p_max_attempts: MAX_EVENT_ATTEMPTS,
    });
    for (const claimed of events) {
      const event = eventFromClaim(claimed);
      const rendered = renderNotification(event);
      const notificationPayload = {
        category: rendered.category,
        title: rendered.title,
        body: rendered.body,
        deepLink: rendered.deepLink,
        targetType: rendered.targetType,
        targetId: rendered.targetId,
        metadata: rendered.metadata,
        urgent: event.urgent ?? false,
      };
      try {
        const completed = await supabaseAdminRpc<{ accepted: boolean; notificationId?: string }>(
          "complete_notification_event",
          {
            p_event_id: claimed.id,
            p_lease_token: claimed.lease_token,
            p_notification: notificationPayload,
          },
        );
        if (completed.accepted && completed.notificationId) {
          results.push({
            job: { id: claimed.id, status: "sent" },
            notification: notificationFromRendered(rendered, completed.notificationId),
          });
        }
      } catch (error) {
        await this.failEvent(claimed, error);
        results.push({ job: { id: claimed.id, status: "queued" }, notification: null });
      }
    }

    const scheduled = await supabaseAdminRpc<ClaimedScheduled[]>("claim_scheduled_notifications", {
      p_worker_id: this.workerId,
      p_limit: 100,
      p_lease_seconds: LEASE_SECONDS,
      p_max_attempts: MAX_EVENT_ATTEMPTS,
    });
    for (const claimed of scheduled) {
      const event = eventFromClaim(claimed);
      const rendered = renderNotification(event);
      try {
        await supabaseAdminRpc<string>("materialize_notification", {
          p_event_id: claimed.id,
          p_idempotency_key: claimed.idempotency_key,
          p_user_id: claimed.user_id,
          p_event_type: event.type,
          p_category: rendered.category,
          p_title: rendered.title,
          p_body: rendered.body,
          p_deep_link: rendered.deepLink,
          p_target_type: rendered.targetType,
          p_target_id: rendered.targetId,
          p_metadata: rendered.metadata,
          p_urgent: event.urgent ?? false,
        });
        await supabaseAdminRpc("complete_scheduled_notification", {
          p_id: claimed.id,
          p_lease_token: claimed.lease_token,
          p_status: "sent",
        });
        results.push({ job: { id: claimed.id, status: "sent" }, notification: rendered });
      } catch (error) {
        await this.failScheduled(claimed, error);
        results.push({ job: { id: claimed.id, status: "queued" }, notification: null });
      }
    }
    return results;
  }

  async recoverInterruptedWork(): Promise<JsonObject> {
    this.assertReliableWorkerStorage();
    return supabaseAdminRpc<JsonObject>("recover_notification_work", {
      p_lease_seconds: LEASE_SECONDS,
      p_max_attempts: MAX_DELIVERY_ATTEMPTS,
    });
  }

  async flushQueued(provider: PushNotificationProvider): Promise<{
    attempted: number;
    sent: number;
    failed: number;
    invalidated: number;
    deferred: number;
  }> {
    this.assertReliableWorkerStorage();
    const claimed = await supabaseAdminRpc<ClaimedDelivery[]>("claim_notification_deliveries", {
      p_worker_id: this.workerId,
      p_limit: 100,
      p_lease_seconds: LEASE_SECONDS,
      p_max_attempts: MAX_DELIVERY_ATTEMPTS,
    });
    const summary = { attempted: 0, sent: 0, failed: 0, invalidated: 0, deferred: 0 };
    for (const delivery of claimed) {
      if (!delivery.token) {
        await this.completeDelivery(delivery, "suppressed", "device_unavailable", false);
        summary.deferred++;
        continue;
      }
      summary.attempted++;
      try {
        if (!await provider.validateToken(delivery.token)) {
          await this.completeDelivery(delivery, "failed", "invalid_token", true);
          summary.invalidated++;
          summary.failed++;
          continue;
        }
        const result = await provider.send({
          token: delivery.token,
          title: delivery.title,
          body: delivery.body,
          data: delivery.deep_link ? { deepLink: delivery.deep_link } : undefined,
        });
        await supabaseAdminRpc("complete_notification_delivery", {
          p_id: delivery.id,
          p_lease_token: delivery.lease_token,
          p_status: "sent",
          p_provider_message_id: result.providerMessageId ?? null,
        });
        summary.sent++;
      } catch (error) {
        const message = error instanceof Error ? error.message : "push_failed";
        const permanent = /DeviceNotRegistered|invalid.?token|not.?registered/i.test(message);
        if (permanent) {
          await this.completeDelivery(delivery, "failed", "invalid_token", true);
          summary.invalidated++;
          summary.failed++;
        } else if (delivery.attempt_count >= MAX_DELIVERY_ATTEMPTS) {
          await this.completeDelivery(delivery, "failed", "provider_error", false);
          summary.failed++;
        } else {
          await this.completeDelivery(delivery, "queued", "provider_error", false);
          summary.deferred++;
        }
      }
    }
    return summary;
  }

  async runMaintenance(
    moderationMediaRetentionDays = DEFAULT_MODERATION_MEDIA_RETENTION_DAYS,
  ): Promise<JsonObject> {
    this.assertReliableWorkerStorage();
    if (!Number.isInteger(moderationMediaRetentionDays) || moderationMediaRetentionDays <= 0) {
      throw new Error("Moderation media retention must be a positive number of days.");
    }
    const maintenance = await supabaseAdminRpc<JsonObject>("run_scheduled_maintenance");
    const moderationMedia = await this.runModerationMediaCleanup(moderationMediaRetentionDays);
    return { ...maintenance, moderation_media: moderationMedia };
  }

  private async runModerationMediaCleanup(retentionDays: number): Promise<ModerationRetentionSummary> {
    const rejectedBefore = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
    const candidates = await supabaseAdminRpc<ModerationRetentionCandidate[]>(
      "list_moderation_retention_candidates",
      {
        p_rejected_before: rejectedBefore,
        p_exact_location_before: null,
      },
    );
    const summary: ModerationRetentionSummary = {
      candidates: candidates.length,
      claimed: 0,
      deleted: 0,
      missing: 0,
      failed: 0,
      skipped: 0,
      errors: [],
    };

    for (const candidate of candidates) {
      let claimed: ClaimedModerationRetentionCandidate | undefined;
      try {
        const rows = await supabaseAdminRpc<ClaimedModerationRetentionCandidate[]>(
          "claim_moderation_retention_candidate",
          {
            p_media_id: candidate.media_id,
            p_rejected_before: rejectedBefore,
            p_worker_id: this.workerId,
            p_lease_seconds: LEASE_SECONDS,
          },
        );
        claimed = rows[0];
        if (!claimed) {
          summary.skipped++;
          continue;
        }
        summary.claimed++;
      } catch (error) {
        summary.failed++;
        this.recordModerationCleanupError(summary, candidate.media_id, error);
        continue;
      }

      let outcome: SupabaseStorageDeleteResult;
      try {
        outcome = await deleteSupabaseStorageObject(claimed.bucket, claimed.storage_path);
      } catch (error) {
        summary.failed++;
        this.recordModerationCleanupError(summary, claimed.media_id, error);
        try {
          await this.completeModerationRetentionCandidate(claimed, "failed", error);
        } catch (completionError) {
          this.recordModerationCleanupError(summary, claimed.media_id, completionError);
        }
        continue;
      }

      try {
        const completion = await this.completeModerationRetentionCandidate(claimed, outcome, null);
        if (completion.status !== "completed") {
          throw new Error(`Moderation media cleanup completion was ${completion.status}.`);
        }
        if (outcome === "missing") summary.missing++;
        else summary.deleted++;
      } catch (error) {
        summary.failed++;
        this.recordModerationCleanupError(summary, claimed.media_id, error);
      }
    }
    return summary;
  }

  private recordModerationCleanupError(
    summary: ModerationRetentionSummary,
    mediaId: string,
    error: unknown,
  ) {
    if (summary.errors.length >= 50) return;
    summary.errors.push({
      mediaId,
      error: error instanceof Error ? error.message : "moderation_media_cleanup_failed",
    });
  }

  private async completeModerationRetentionCandidate(
    candidate: ClaimedModerationRetentionCandidate,
    outcome: SupabaseStorageDeleteResult | "failed",
    error: unknown,
  ): Promise<{ status: string }> {
    return supabaseAdminRpc<{ status: string }>("complete_moderation_retention_candidate", {
      p_media_id: candidate.media_id,
      p_lease_token: candidate.lease_token,
      p_outcome: outcome,
      p_error: error instanceof Error
        ? error.message
        : error
          ? "moderation_media_cleanup_failed"
          : null,
      p_retry_minutes: RETENTION_RETRY_DELAY_MINUTES,
    });
  }

  private async failEvent(claimed: ClaimedEvent, error: unknown) {
    await supabaseAdminRpc("complete_notification_event", {
      p_event_id: claimed.id,
      p_lease_token: claimed.lease_token,
      p_notification: null,
      p_retry_at: claimed.attempt_count < MAX_EVENT_ATTEMPTS ? retryAt(claimed.attempt_count) : null,
      p_error: error instanceof Error ? error.message : "notification_processing_failed",
    });
  }

  private async failScheduled(claimed: ClaimedScheduled, error: unknown) {
    await supabaseAdminRpc("complete_scheduled_notification", {
      p_id: claimed.id,
      p_lease_token: claimed.lease_token,
      p_status: "failed",
      p_retry_at: claimed.attempts < MAX_EVENT_ATTEMPTS ? retryAt(claimed.attempts) : null,
      p_error: error instanceof Error ? error.message : "scheduled_notification_failed",
    });
  }

  private async completeDelivery(
    delivery: ClaimedDelivery,
    status: "failed" | "queued" | "suppressed",
    failureCategory: string,
    disableDevice: boolean,
  ) {
    await supabaseAdminRpc("complete_notification_delivery", {
      p_id: delivery.id,
      p_lease_token: delivery.lease_token,
      p_status: status,
      p_failure_category: failureCategory,
      p_retry_at: status === "queued" ? retryAt(delivery.attempt_count) : null,
      p_disable_device: disableDevice,
    });
  }

  private async getByIdempotency(idempotencyKey: string): Promise<NotificationRecord | null> {
    const rows = await supabaseAdminRequest<Array<JsonObject>>(
      `notifications?select=id,user_id,type,title,body,deep_link,target_type,target_id,domain_event_id,idempotency_key,created_at,read_at,archived_at,metadata&idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&limit=1`,
    );
    return rows[0] ? this.mapNotification(rows[0]) : null;
  }

  private mapNotification(row: JsonObject): NotificationRecord {
    return {
      id: String(row.id),
      userId: String(row.user_id),
      type: String(row.type),
      category: String(row.category ?? "system") as NotificationCategory,
      title: String(row.title),
      body: String(row.body),
      deepLink: row.deep_link ? String(row.deep_link) : null,
      targetType: row.target_type ? String(row.target_type) : null,
      targetId: row.target_id ? String(row.target_id) : null,
      domainEventId: row.domain_event_id ? String(row.domain_event_id) : "",
      createdAt: String(row.created_at),
      readAt: row.read_at ? String(row.read_at) : null,
      archivedAt: row.archived_at ? String(row.archived_at) : null,
      metadata: asObject(row.metadata) as Record<string, string | number>,
    };
  }
}
