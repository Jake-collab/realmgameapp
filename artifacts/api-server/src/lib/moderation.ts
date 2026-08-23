import { createHash } from "node:crypto";

export const moderationCategories = [
  "sexual_content", "nudity", "graphic_violence", "self_harm", "threats",
  "hate_or_harassment", "illegal_activity", "drugs", "weapons", "extremism",
  "private_information", "scam_or_fraud", "spam", "dangerous_activity", "other",
] as const;
export type ModerationCategory = (typeof moderationCategories)[number];
export type ModerationDecision = "safe" | "warning" | "manual_review" | "blocked";
export type ModerationAction = "allow" | "allow_flagged" | "quarantine" | "manual_review" | "reject";
export type ModerationContext = "public_media" | "private_proof" | "public_text" | "ai_quest" | "profile";

export type ModerationResult = {
  decision: ModerationDecision;
  categories: Array<{ category: ModerationCategory; score?: number; matched?: boolean }>;
  provider: string;
  model?: string;
  providerReference?: string;
  checkedAt: string;
  contentHash: string;
  policyVersion: string;
  reviewRequired: boolean;
  userVisibleReason: string;
};

export type ModerationOutcome = {
  action: ModerationAction;
  result: ModerationResult;
  reason: string;
  publicSafe: boolean;
};

export interface ModerationProvider {
  moderateImage(input: { contentHash: string; mediaUrl?: string; context: ModerationContext }): Promise<ModerationResult>;
  moderateText(input: { contentHash: string; text: string; context: ModerationContext }): Promise<ModerationResult>;
  healthCheck(): Promise<{ configured: boolean; reachable: boolean; provider: string; lastError?: string }>;
}

export const MODERATION_POLICY_VERSION = "worlds-moderation-1";

function contentHash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function unavailableResult(hash: string): ModerationResult {
  return {
    decision: "manual_review",
    categories: [],
    provider: process.env.MODERATION_PROVIDER ?? "manual",
    model: process.env.MODERATION_MODEL,
    checkedAt: new Date().toISOString(),
    contentHash: hash,
    policyVersion: MODERATION_POLICY_VERSION,
    reviewRequired: true,
    userVisibleReason: "This content is waiting for a safety review.",
  };
}

function decisionFromCategories(categories: Array<{ category: ModerationCategory; score?: number; matched?: boolean }>): ModerationDecision {
  const severe = categories.some((item) => item.matched && ["sexual_content", "graphic_violence", "self_harm", "threats", "hate_or_harassment", "illegal_activity", "extremism"].includes(item.category));
  const warning = categories.some((item) => item.matched || (item.score ?? 0) >= 0.5);
  return severe ? "blocked" : warning ? "warning" : "safe";
}

function normalizeProviderPayload(payload: unknown, hash: string): ModerationResult {
  const record = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const rawCategories = Array.isArray(record.categories)
    ? record.categories
    : Array.isArray(record.results)
      ? Object.entries(
          record.results[0] && typeof record.results[0] === "object"
            ? ((record.results[0] as Record<string, unknown>).category_scores ?? {})
            : {},
        ).map(([category, score]) => ({ category, score }))
      : [];
  const categories = rawCategories.flatMap((item) => {
    if (typeof item === "string" && moderationCategories.includes(item as ModerationCategory)) return [{ category: item as ModerationCategory, matched: true }];
    if (!item || typeof item !== "object") return [];
    const value = item as Record<string, unknown>;
    const rawCategory = String(value.category ?? "");
    const categoryAliases: Record<string, ModerationCategory> = {
      sexual: "sexual_content",
      violence: "graphic_violence",
      "self-harm": "self_harm",
      hate: "hate_or_harassment",
      harassment: "hate_or_harassment",
      illicit: "illegal_activity",
      "illicit/violent": "illegal_activity",
    };
    const category = categoryAliases[rawCategory] ?? rawCategory;
    return moderationCategories.includes(category as ModerationCategory)
      ? [{ category: category as ModerationCategory, score: typeof value.score === "number" ? value.score : undefined, matched: Boolean(value.matched ?? (typeof value.score === "number" ? value.score >= 0.5 : true)) }]
      : [];
  });
  if (!Array.isArray(record.categories) && !Array.isArray(record.results)) return unavailableResult(hash);
  const decision = decisionFromCategories(categories);
  return {
    decision,
    categories,
    provider: process.env.MODERATION_PROVIDER ?? "openai-compatible",
    model: process.env.MODERATION_MODEL,
    providerReference: typeof record.id === "string" ? record.id : undefined,
    checkedAt: new Date().toISOString(),
    contentHash: hash,
    policyVersion: MODERATION_POLICY_VERSION,
    reviewRequired: decision !== "safe",
    userVisibleReason: decision === "blocked" ? "This content does not meet Worlds guidelines." : decision === "warning" ? "This content needs a safety review." : "Content passed the automated safety check.",
  };
}

class ManualProvider implements ModerationProvider {
  async moderateImage(input: { contentHash: string }) { return unavailableResult(input.contentHash); }
  async moderateText(input: { contentHash: string }) { return unavailableResult(input.contentHash); }
  async healthCheck() { return { configured: false, reachable: false, provider: "manual" }; }
}

class CompatibleProvider implements ModerationProvider {
  private async call(payload: Record<string, unknown>, hash: string) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Number(process.env.MODERATION_TIMEOUT_MS ?? 8000));
    try {
      const response = await fetch(process.env.MODERATION_API_URL ?? "https://api.openai.com/v1/moderations", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${process.env.MODERATION_API_KEY}` },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!response.ok) return unavailableResult(hash);
      return normalizeProviderPayload(await response.json(), hash);
    } catch {
      return unavailableResult(hash);
    } finally {
      clearTimeout(timer);
    }
  }
  async moderateImage(input: { contentHash: string; mediaUrl?: string; context: ModerationContext }) {
    return this.call({ input: input.mediaUrl ?? input.contentHash, metadata: { context: input.context } }, input.contentHash);
  }
  async moderateText(input: { contentHash: string; text: string; context: ModerationContext }) {
    return this.call({ input: input.text, metadata: { context: input.context } }, input.contentHash);
  }
  async healthCheck() {
    if (!process.env.MODERATION_API_KEY) return { configured: false, reachable: false, provider: process.env.MODERATION_PROVIDER ?? "openai-compatible" };
    const started = Date.now();
    try {
      const response = await fetch(process.env.MODERATION_HEALTH_URL ?? "https://api.openai.com/v1/models", { headers: { authorization: `Bearer ${process.env.MODERATION_API_KEY}` } });
      return { configured: true, reachable: response.ok, provider: process.env.MODERATION_PROVIDER ?? "openai-compatible", latencyMs: Date.now() - started, ...(response.ok ? {} : { lastError: `HTTP ${response.status}` }) };
    } catch {
      return { configured: true, reachable: false, provider: process.env.MODERATION_PROVIDER ?? "openai-compatible", latencyMs: Date.now() - started, lastError: "Provider unavailable" };
    }
  }
}

export function getModerationProvider(): ModerationProvider {
  if (process.env.NODE_ENV !== "production" && process.env.MODERATION_STUB_DECISION) {
    const decision = process.env.MODERATION_STUB_DECISION as ModerationDecision;
    return {
      async moderateImage(input) { return { ...unavailableResult(input.contentHash), decision, provider: "development-stub", reviewRequired: decision !== "safe" }; },
      async moderateText(input) { return { ...unavailableResult(input.contentHash), decision, provider: "development-stub", reviewRequired: decision !== "safe" }; },
      async healthCheck() { return { configured: true, reachable: true, provider: "development-stub" }; },
    };
  }
  return process.env.MODERATION_AUTOMATION_ENABLED === "true" && process.env.MODERATION_API_KEY ? new CompatibleProvider() : new ManualProvider();
}

export function applyModerationPolicy(result: ModerationResult, context: ModerationContext, options?: { accountInGoodStanding?: boolean; priorSevereAbuse?: boolean; reported?: boolean }): ModerationOutcome {
  const reported = options?.reported ?? false;
  const highRisk = result.decision === "blocked" || result.decision === "manual_review" || result.decision === "warning" || reported || options?.priorSevereAbuse;
  if (result.decision === "blocked") return { action: context === "private_proof" ? "quarantine" : "reject", result: { ...result, reviewRequired: true }, reason: "Blocked safety category requires review before use.", publicSafe: false };
  if (highRisk || !options?.accountInGoodStanding) return { action: "manual_review", result: { ...result, reviewRequired: true }, reason: "Content requires human moderation.", publicSafe: false };
  const autoApprove = process.env.MODERATION_AUTO_APPROVAL_MODE === "low_risk" && context !== "private_proof";
  return { action: autoApprove ? "allow" : "manual_review", result, reason: autoApprove ? "Low-risk content passed the configured policy." : "Manual-only moderation mode is active.", publicSafe: autoApprove };
}

export async function moderateText(text: string, context: ModerationContext, options?: { accountInGoodStanding?: boolean; priorSevereAbuse?: boolean; reported?: boolean }) {
  const hash = contentHash(text);
  const result = await getModerationProvider().moderateText({ contentHash: hash, text, context });
  return applyModerationPolicy(result, context, options);
}

export async function moderateImage(input: { contentHash?: string; mediaUrl?: string; context: ModerationContext }, options?: { accountInGoodStanding?: boolean; priorSevereAbuse?: boolean; reported?: boolean }) {
  const hash = input.contentHash ?? contentHash(input.mediaUrl ?? "missing-media-input");
  const result = await getModerationProvider().moderateImage({ ...input, contentHash: hash });
  return applyModerationPolicy(result, input.context, options);
}

export async function moderationDiagnostics() {
  const health = await getModerationProvider().healthCheck();
  return {
    provider: { configured: health.configured, reachable: health.reachable, name: health.provider, lastError: health.lastError ?? null },
    policyVersion: MODERATION_POLICY_VERSION,
    automationEnabled: process.env.MODERATION_AUTOMATION_ENABLED === "true",
    autoApprovalMode: process.env.MODERATION_AUTO_APPROVAL_MODE ?? "manual_only",
    privacy: "Provider payloads and internal scores are server-only; proof media remains private.",
  };
}