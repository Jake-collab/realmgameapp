import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";

export const questGenerationTypes = ["daily", "monthly", "geo"] as const;
export type QuestGenerationType = (typeof questGenerationTypes)[number];

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
  difficulty: z.enum(["very_easy", "easy", "medium", "hard", "epic"]),
  estimated_duration_minutes: z.number().int().min(1).max(1440),
  recommended_points: z.number().int().min(1).max(1000),
  category: z.string().trim().min(1).max(80),
  interest_tags: z.array(z.string().trim().min(1).max(60)).max(10),
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
  "current_date", "interest_cluster", "interest_tags", "theme", "season",
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
  const required = type === "daily" ? ["interest_cluster"] : type === "monthly" ? ["theme", "target_month"] : ["public_location_context", "approximate_area"];
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
  if (candidate.recommended_points > 500) diagnostics.push("Recommended points exceed the local review threshold.");
  if (candidate.safety_notes.length === 0) diagnostics.push("Candidate has no explicit safety notes.");
  const duplicate = state.history.some((item) => item.inputFingerprint === fingerprint(candidate));
  if (duplicate) diagnostics.push("Candidate matches a previously generated candidate fingerprint.");
  return { duplicate, reviewRequired: true, diagnostics };
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
    ? [`Daily pool: ${variables.interest_cluster ?? "unassigned"}`, "Use fallback coverage when the interest pool is below target."]
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
  const assembled = `${prompt.systemInstructions}\n${prompt.contentInstructions}\n${prompt.safetyInstructions}\n${prompt.pointInstructions}\n${prompt.proofInstructions}\n${prompt.outputFormat}\n${JSON.stringify(variables)}`;
  const maxRetries = Math.min(3, Math.max(0, Number(process.env.AI_MAX_RETRIES ?? 1)));
  let attemptCount = 0;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Number(process.env.AI_REQUEST_TIMEOUT_MS ?? 15000));
  try {
    let response: Response | undefined;
    for (; attemptCount <= maxRetries; attemptCount += 1) {
      response = await fetch(process.env.AI_API_URL ?? "https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${process.env.AI_API_KEY}` },
        body: JSON.stringify({ model: process.env.AI_MODEL, temperature: Number(process.env.AI_TEMPERATURE ?? 0.4), max_tokens: Number(process.env.AI_MAX_OUTPUT_TOKENS ?? 2000), messages: [{ role: "system", content: assembled }], response_format: { type: "json_object" } }),
        signal: controller.signal,
      });
      if (response.ok || response.status < 500) break;
    }
    if (!response?.ok) {
      const item = { ...base, status: "failed" as const, attemptCount: Math.max(1, attemptCount), reason: "The AI provider rejected the request.", estimatedInputTokens: Math.ceil(assembled.length / 4) };
      recordHistory(item);
      return { ok: false as const, status: "failed" as const, reason: item.reason };
    }
    const body = await response.json() as { choices?: Array<{ message?: { content?: string }; usage?: { prompt_tokens?: number; completion_tokens?: number } }> };
    const content = body.choices?.[0]?.message?.content;
    const parsed = generatedQuestSchema.safeParse(content ? JSON.parse(content) : null);
    if (!parsed.success || parsed.data.quest_type !== type) {
      recordHistory({ ...base, status: "invalid", attemptCount: Math.max(1, attemptCount), reason: "Provider output failed Quest validation.", estimatedInputTokens: Math.ceil(assembled.length / 4) });
      return { ok: false as const, status: "invalid" as const, reason: "The provider returned content that failed Quest validation." };
    }
    const review = inspectCandidate(parsed.data, type);
    const usage = body.choices?.[0]?.usage;
    recordHistory({ ...base, status: "candidate", attemptCount: Math.max(1, attemptCount), inputFingerprint: fingerprint(parsed.data), estimatedInputTokens: usage?.prompt_tokens ?? Math.ceil(assembled.length / 4), estimatedOutputTokens: usage?.completion_tokens ?? Math.ceil(JSON.stringify(parsed.data).length / 4), estimatedCostUsd: 0, diagnostics: review.diagnostics });
    return { ok: true as const, status: "candidate" as const, candidate: parsed.data, review };
  } catch {
    recordHistory({ ...base, status: "failed", attemptCount: Math.max(1, attemptCount), reason: "The AI provider could not be reached." });
    return { ok: false as const, status: "failed" as const, reason: "The AI provider could not be reached." };
  } finally {
    clearTimeout(timer);
  }
}