import type { ModerationOutcome, ModerationResult } from "./moderation";
import { MODERATION_POLICY_VERSION } from "./moderation";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function config() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url, key } : null;
}

async function request<T>(url: string, key: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json", ...init.headers },
  });
  if (!response.ok) throw new Error(`Supabase moderation persistence failed (${response.status})`);
  return response.status === 204 ? (undefined as T) : await response.json() as T;
}

export function supabaseModerationPersistenceAvailable() {
  return Boolean(config());
}

export async function persistModerationResult(input: {
  idempotencyKey: string;
  entityType: string;
  entityId: string;
  context: string;
  contentHash: string;
  result: ModerationResult;
  outcome: ModerationOutcome;
}) {
  const current = config();
  if (!current) return { persisted: false, reason: "Supabase service-role configuration is unavailable." };
  if (!uuidPattern.test(input.entityId)) return { persisted: false, reason: "The entity identifier is not a database UUID." };
  await request(`${current.url}/rest/v1/rpc/record_moderation_result`, current.key, {
    method: "POST",
    body: JSON.stringify({
      p_idempotency_key: input.idempotencyKey,
      p_entity_type: input.entityType,
      p_entity_id: input.entityId,
      p_context: input.context,
      p_content_hash: input.contentHash,
      p_status: "completed",
      p_provider: input.result.provider,
      p_model: input.result.model ?? null,
      p_result: { decision: input.result.decision, categories: input.result.categories, reviewRequired: input.result.reviewRequired, outcome: input.outcome.action },
      p_policy_version: MODERATION_POLICY_VERSION,
    }),
  });
  return { persisted: true, reason: null };
}

export async function persistIntegritySnapshot(input: {
  userId?: string;
  entityType: string;
  entityId: string;
  snapshot: { score: number; band: string; signals: Array<{ id: string }>; recommendedAction: string; requiresReview: boolean; policyVersion: string };
}) {
  const current = config();
  if (!current) return { persisted: false, reason: "Supabase service-role configuration is unavailable." };
  if (!uuidPattern.test(input.entityId)) return { persisted: false, reason: "The entity identifier is not a database UUID." };
  await request(`${current.url}/rest/v1/integrity_risk_snapshots`, current.key, {
    method: "POST",
    headers: { prefer: "return=minimal" },
    body: JSON.stringify({
      user_id: input.userId && uuidPattern.test(input.userId) ? input.userId : null,
      entity_type: input.entityType,
      entity_id: input.entityId,
      policy_version: input.snapshot.policyVersion,
      score: input.snapshot.score,
      risk_band: input.snapshot.band,
      signal_ids: input.snapshot.signals.map((signal) => signal.id),
      recommended_action: input.snapshot.recommendedAction,
      requires_review: input.snapshot.requiresReview,
    }),
  });
  return { persisted: true, reason: null };
}