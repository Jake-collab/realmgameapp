import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";

export const questGenerationTypes = ["daily", "monthly", "geo"] as const;
export type QuestGenerationType = (typeof questGenerationTypes)[number];
export const canonicalQuestPoints = {
  easy: 100,
  medium: 200,
  hard: 300,
  epic: 500,
} as const;

const promptFields = z.object({
  systemInstructions: z.string().trim().min(1).max(12000),
  contentInstructions: z.string().trim().min(1).max(12000),
  safetyInstructions: z.string().trim().min(1).max(12000),
  pointInstructions: z.string().trim().min(1).max(12000),
  proofInstructions: z.string().trim().min(1).max(12000),
  outputFormat: z.string().trim().min(1).max(12000),
});

export const generatedQuestSchema = z.object({
  title: z.string().trim().min(3).max(120),
  summary: z.string().trim().min(10).max(300),
  description: z.string().trim().min(20).max(4000),
  quest_type: z.enum(questGenerationTypes),
  difficulty: z.enum(["easy", "medium", "hard", "epic"]),
  estimated_duration_minutes: z.number().int().min(1).max(1440),
  recommended_points: z.number().int().min(1).max(1000),
  category: z.string().trim().min(1).max(80),
  interest_bubble_ids: z.array(z.string().uuid()).max(10),
  objectives: z.array(z.string().trim().min(1).max(500)).min(1).max(20),
  proof_type: z.enum(["photo", "video", "text", "location", "none"]),
  proof_instructions: z.string().max(1000),
  safety_notes: z.array(z.string().max(500)).max(20),
  accessibility_notes: z.array(z.string().max(500)).max(20),
  location_requirement: z.enum(["none", "approximate", "precise"]),
  reasoning_metadata: z.object({
    difficulty_reason: z.string().max(300),
    points_reason: z.string().max(300),
    proof_reason: z.string().max(300),
  }),
});
export type GeneratedQuest = z.infer<typeof generatedQuestSchema>;

type ProviderCompletion = {
  content: string | null;
  promptTokens?: number;
  completionTokens?: number;
  retryable: boolean;
};

/**
 * Provider adapters are server-only. Browser and mobile code only ever sees
 * normalized candidates and safe provider health, never an API key or raw
 * provider response.
 */
export interface QuestGenerationProvider {
  complete(input: { prompt: string; signal: AbortSignal }): Promise<ProviderCompletion>;
}

export function getQuestGenerationProvider(): QuestGenerationProvider {
  return {
    async complete(input) {
      const response = await fetch(process.env.AI_API_URL ?? "https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${process.env.AI_API_KEY}` },
        body: JSON.stringify({
          model: process.env.AI_MODEL,
          temperature: Number(process.env.AI_TEMPERATURE ?? 0.4),
          max_tokens: Number(process.env.AI_MAX_OUTPUT_TOKENS ?? 2000),
          messages: [{ role: "system", content: input.prompt }],
          response_format: { type: "json_object" },
        }),
        signal: input.signal,
      });
      if (!response.ok) {
        return { content: null, retryable: response.status >= 500 };
      }
      const body = await response.json() as { choices?: Array<{ message?: { content?: string } }>; usage?: { prompt_tokens?: number; completion_tokens?: number } };
      return {
        content: body.choices?.[0]?.message?.content ?? null,
        promptTokens: body.usage?.prompt_tokens,
        completionTokens: body.usage?.completion_tokens,
        retryable: false,
      };
    },
  };
}

const immutableSafetyRules = [
  "Never require trespassing, unsafe activity, private information, or restricted access.",
  "Never invent authoritative coordinates, operating hours, accessibility, or location facts.",
  "Generated content is a draft candidate only and must not be published or awarded points automatically.",
].join(" ");

export interface PromptVersion extends z.infer<typeof promptFields> {
  id: string;
  type: QuestGenerationType;
  version: number;
  active: boolean;
  createdAt: string;
  updatedBy: string;
  changeReason: string;
}

export type GenerationHistoryItem = {
  id: string;
  type: QuestGenerationType;
  status: "candidate" | "failed" | "invalid" | "unavailable" | "rate_limited";
  createdAt: string;
  requestedBy: string;
  quantity: number;
  attemptCount: number;
  promptVersion: number | null;
  inputFingerprint: string;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedCostUsd: number;
  reason?: string;
  diagnostics?: string[];
};

const defaultText = (type: QuestGenerationType) =>
  type === "daily"
    ? "Create a short, safe, achievable Quest for an interest-aware Daily pool."
    : type === "monthly"
      ? "Create a varied, thematic Quest suitable for a Monthly Quest collection."
      : "Create a safe Quest concept grounded in the supplied public location context.";

const defaultPrompt = (type: QuestGenerationType): PromptVersion => ({
  id: `${type}-template-v1`,
  type,
  version: 1,
  systemInstructions: "You create structured Worlds Quest content. Never invent protected facts or coordinates.",
  contentInstructions: defaultText(type),
  safetyInstructions: "Do not require trespassing, unsafe activity, private information, or unverifiable access claims.",
  pointInstructions: "Recommend points only; the platform's deterministic validator and staff review decide the final reward.",
  proofInstructions: "Use only supported proof types. Never return QR proof.",
  outputFormat: "Return one JSON object matching the generated Quest schema.",
  active: true,
  createdAt: new Date(0).toISOString(),
  updatedBy: "system",
  changeReason: "Initial safe default",
});

type LocalState = {
  templates: Record<QuestGenerationType, PromptVersion[]>;
  history: GenerationHistoryItem[];
};

const statePath = process.env.AI_LOCAL_STATE_PATH ?? path.join(process.cwd(), ".local", "admin-ai-state.json");
const freshState = (): LocalState => ({
  templates: { daily: [defaultPrompt("daily")], monthly: [defaultPrompt("monthly")], geo: [defaultPrompt("geo")] },
  history: [],
});

function loadState(): LocalState {
  try {
    const parsed = JSON.parse(fs.readFileSync(statePath, "utf8")) as Partial<LocalState>;
    const initial = freshState();
    return {
      templates: {
        daily: parsed.templates?.daily?.length ? parsed.templates.daily : initial.templates.daily,
        monthly: parsed.templates?.monthly?.length ? parsed.templates.monthly : initial.templates.monthly,
        geo: parsed.templates?.geo?.length ? parsed.templates.geo : initial.templates.geo,
      },
      history: Array.isArray(parsed.history) ? parsed.history.slice(-500) : [],
    };
  } catch {
    return freshState();
  }
}

const state = loadState();
const requestWindows = new Map<string, { startedAt: number; count: number }>();

function persistState() {
  if (process.env.NODE_ENV === "production" && !process.env.AI_LOCAL_STATE_PATH) return;
  try {
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    const temporary = `${statePath}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(state, null, 2), { mode: 0o600 });
    fs.renameSync(temporary, statePath);
  } catch {
    // Local persistence is best-effort; production writes remain Supabase-owned.
  }
}

export function listPromptVersions(type?: QuestGenerationType) {
  return type ? [...state.templates[type]] : questGenerationTypes.flatMap((item) => state.templates[item]);
}

export function createPromptVersion(
  type: QuestGenerationType,
  input: z.input<typeof promptFields> & { changeReason: string; updatedBy: string },
) {
  const parsed = promptFields.parse(input);
  const versions = state.templates[type];
  const version: PromptVersion = {
    ...parsed,
    id: `${type}-template-v${versions.length + 1}`,
    type,
    version: versions.length + 1,
    active: false,
    createdAt: new Date().toISOString(),
    updatedBy: input.updatedBy,
    changeReason: input.changeReason,
  };
  versions.push(version);
  persistState();
  return version;
}

export function changePromptState(
  type: QuestGenerationType,
  versionNumber: number,
  action: "activate" | "deactivate" | "restore",
  updatedBy: string,
) {
  const versions = state.templates[type];
  const target = versions.find((item) => item.version === versionNumber);
  if (!target) return null;
  if (action === "restore") {
    return createPromptVersion(type, { ...target, changeReason: `Restored version ${versionNumber}`, updatedBy });
  }
  versions.forEach((item) => { item.active = action === "activate" ? item.version === versionNumber : item.active && item.version !== versionNumber; });
  persistState();
  return target;
}

export function getActivePrompt(type: QuestGenerationType) {
  return state.templates[type].find((item) => item.active) ?? null;
}

export function aiConfiguration() {
  return {
    configured: Boolean(process.env.AI_API_KEY && process.env.AI_MODEL),
    provider: process.env.AI_PROVIDER ?? "openai-compatible",
    model: process.env.AI_MODEL ?? null,
  };
}

const allowedVariables = new Set([
  "current_date", "interest_bubble_ids", "theme", "season",
  "target_month", "public_location_context", "approximate_area", "region",
  "weather_context", "difficulty", "point_budget",
]);

export function validatePromptVariables(template: string, supplied: Record<string, string>) {
  const variables = [...new Set([...template.matchAll(/\{\{([a-z0-9_]+)\}\}/g)].map((match) => match[1]))];
  const missing = variables.filter((name) => !(name in supplied) || !supplied[name].trim());
  const unknown = Object.keys(supplied).filter((name) => !allowedVariables.has(name));
  const rendered = template.replace(/\{\{([a-z0-9_]+)\}\}/g, (_, name: string) => supplied[name] ?? `{{${name}}}`);
  return { variables, missing, unknown, valid: missing.length === 0 && unknown.length === 0, rendered };
}

export function validateGenerationInputs(type: QuestGenerationType, variables: Record<string, string>) {
  const required = type === "daily" ? ["interest_bubble_ids"] : type === "monthly" ? ["theme", "target_month"] : ["public_location_context", "approximate_area"];
  const missing = required.filter((key) => !variables[key]?.trim());
  const unknown = Object.keys(variables).filter((key) => !allowedVariables.has(key));
  return { valid: missing.length === 0 && unknown.length === 0, missing, unknown };
}

function fingerprint(candidate: GeneratedQuest) {
  return createHash("sha256").update(`${candidate.title}|${candidate.description}`.toLowerCase().replace(/\s+/g, " ")).digest("hex");
}

export function inspectCandidate(candidate: GeneratedQuest, type: QuestGenerationType) {
  const diagnostics: string[] = [];
  if (candidate.quest_type !== type) diagnostics.push("Quest type does not match the requested generation lane.");
  if (candidate.proof_type === "location" && candidate.location_requirement === "none") diagnostics.push("Location proof requires a location requirement.");
  if (candidate.recommended_points !== canonicalQuestPoints[candidate.difficulty]) {
    diagnostics.push(`Recommended points must use the canonical ${candidate.difficulty.toUpperCase()} base of ${canonicalQuestPoints[candidate.difficulty]}.`);
  }
  if (candidate.safety_notes.length === 0) diagnostics.push("Candidate has no explicit safety notes.");
  if (candidate.quest_type === "geo" && candidate.location_requirement === "none") diagnostics.push("Geo Quests must require staff-verified approximate or precise location context.");
  if (candidate.quest_type !== "geo" && candidate.location_requirement === "precise") diagnostics.push("Only staff-reviewed Geo Quests may request precise location.");
  if (candidate.proof_type === "none" && candidate.proof_instructions.trim()) diagnostics.push("No-proof candidates must not contain proof instructions.");
  if (candidate.interest_bubble_ids.length === 0) diagnostics.push("Candidate must include at least one approved Interest Bubble.");
  const unsafeLanguage = /\b(trespass|break in|private residence|restricted area|dangerous|unsafe)\b/i.test(`${candidate.title} ${candidate.summary} ${candidate.description}`);
  if (unsafeLanguage) diagnostics.push("Candidate contains a potentially unsafe or private-access claim.");
  const duplicate = state.history.some((item) => item.inputFingerprint === fingerprint(candidate));
  if (duplicate) diagnostics.push("Candidate matches a previously generated candidate fingerprint.");
  return { duplicate, reviewRequired: true, diagnostics, valid: diagnostics.length === 0 };
}

export function listGenerationHistory() {
  return [...state.history].reverse();
}

function recordHistory(item: GenerationHistoryItem) {
  state.history.push(item);
  state.history.splice(0, Math.max(0, state.history.length - 500));
  persistState();
}

export function getGenerationPlan(type: QuestGenerationType, quantity: number, variables: Record<string, string>) {
  const diagnostics = type === "daily"
    ? [`Daily Interest Bubbles: ${variables.interest_bubble_ids ?? "unassigned"}`, "Use fallback coverage when the interest pool is below target."]
    : type === "monthly"
      ? [`Monthly theme: ${variables.theme ?? "unassigned"}`, `Target month: ${variables.target_month ?? "unassigned"}`, "Balance difficulty and points across the staged batch."]
      : [`Grounding area: ${variables.approximate_area ?? "unassigned"}`, "Claim verification and exact-coordinate validation remain a human review step."];
  return { type, quantity, diagnostics, replacementAllowed: true, publishRequiresReview: true };
}

export function consumeGenerationQuota(requestedBy: string, quantity: number) {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const limit = Math.max(1, Number(process.env.AI_RATE_LIMIT_PER_HOUR ?? 100));
  const current = requestWindows.get(requestedBy);
  const window = !current || now - current.startedAt >= windowMs ? { startedAt: now, count: 0 } : current;
  if (window.count + quantity > limit) {
    return { allowed: false, remaining: Math.max(0, limit - window.count), retryAfterSeconds: Math.ceil((window.startedAt + windowMs - now) / 1000) };
  }
  window.count += quantity;
  requestWindows.set(requestedBy, window);
  return { allowed: true, remaining: limit - window.count, retryAfterSeconds: 0 };
}

export async function generateQuest(type: QuestGenerationType, variables: Record<string, string>, requestedBy = "staff") {
  const inputCheck = validateGenerationInputs(type, variables);
  const prompt = getActivePrompt(type);
  const base = {
    id: randomUUID(),
    type,
    createdAt: new Date().toISOString(),
    requestedBy,
    quantity: 1,
    promptVersion: prompt?.version ?? null,
    inputFingerprint: createHash("sha256").update(JSON.stringify(variables)).digest("hex"),
    estimatedInputTokens: 0,
    estimatedOutputTokens: 0,
    estimatedCostUsd: 0,
  };
  if (!inputCheck.valid) {
    recordHistory({ ...base, status: "invalid", attemptCount: 0, reason: `Missing: ${inputCheck.missing.join(", ") || "none"}; unknown: ${inputCheck.unknown.join(", ") || "none"}` });
    return { ok: false as const, status: "invalid" as const, reason: "Generation inputs failed lane validation.", missing: inputCheck.missing, unknown: inputCheck.unknown };
  }
  const config = aiConfiguration();
  if (!config.configured || !prompt) {
    recordHistory({ ...base, status: "unavailable", attemptCount: 0, reason: "AI provider configuration is unavailable." });
    return { ok: false as const, status: "unavailable" as const, reason: "AI provider configuration is unavailable." };
  }
  const assembled = `${immutableSafetyRules}\n${prompt.systemInstructions}\n${prompt.contentInstructions}\n${prompt.safetyInstructions}\n${prompt.pointInstructions}\n${prompt.proofInstructions}\n${prompt.outputFormat}\nTrusted variables only: ${JSON.stringify(variables)}`;
  const maxRetries = Math.min(3, Math.max(0, Number(process.env.AI_MAX_RETRIES ?? 1)));
  let attemptCount = 0;
  const provider = getQuestGenerationProvider();
  try {
    let completion: ProviderCompletion | undefined;
    for (; attemptCount <= maxRetries; attemptCount += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), Number(process.env.AI_REQUEST_TIMEOUT_MS ?? 15000));
      try {
        completion = await provider.complete({ prompt: assembled, signal: controller.signal });
      } finally {
        clearTimeout(timer);
      }
      if (!completion.retryable) break;
    }
    if (!completion?.content) {
      const item = { ...base, status: "failed" as const, attemptCount: Math.max(1, attemptCount), reason: "The AI provider rejected the request.", estimatedInputTokens: Math.ceil(assembled.length / 4) };
      recordHistory(item);
      return { ok: false as const, status: "failed" as const, reason: item.reason };
    }
    let rawCandidate: unknown = null;
    try { rawCandidate = JSON.parse(completion.content); } catch { /* recorded as invalid below */ }
    const parsed = generatedQuestSchema.safeParse(rawCandidate);
    if (!parsed.success || parsed.data.quest_type !== type) {
      recordHistory({ ...base, status: "invalid", attemptCount: Math.max(1, attemptCount), reason: "Provider output failed Quest validation.", estimatedInputTokens: Math.ceil(assembled.length / 4) });
      return { ok: false as const, status: "invalid" as const, reason: "The provider returned content that failed Quest validation." };
    }
    const review = inspectCandidate(parsed.data, type);
    if (!review.valid) {
      recordHistory({ ...base, status: "invalid", attemptCount: Math.max(1, attemptCount), inputFingerprint: fingerprint(parsed.data), estimatedInputTokens: Math.ceil(assembled.length / 4), diagnostics: review.diagnostics, reason: "Candidate failed deterministic safety validation." });
      return { ok: false as const, status: "invalid" as const, reason: "The provider candidate failed Worlds safety validation.", review };
    }
    recordHistory({ ...base, status: "candidate", attemptCount: Math.max(1, attemptCount), inputFingerprint: fingerprint(parsed.data), estimatedInputTokens: completion.promptTokens ?? Math.ceil(assembled.length / 4), estimatedOutputTokens: completion.completionTokens ?? Math.ceil(JSON.stringify(parsed.data).length / 4), estimatedCostUsd: 0, diagnostics: review.diagnostics });
    return { ok: true as const, status: "candidate" as const, candidate: parsed.data, review };
  } catch {
    recordHistory({ ...base, status: "failed", attemptCount: Math.max(1, attemptCount), reason: "The AI provider could not be reached." });
    return { ok: false as const, status: "failed" as const, reason: "The AI provider could not be reached." };
  } finally {}
}