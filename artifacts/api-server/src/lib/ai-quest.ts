import { z } from "zod";

export const questGenerationTypes = ["daily", "monthly", "geo"] as const;
export type QuestGenerationType = (typeof questGenerationTypes)[number];

const promptFields = z.object({
  systemInstructions: z.string().min(1),
  contentInstructions: z.string().min(1),
  safetyInstructions: z.string().min(1),
  pointInstructions: z.string().min(1),
  proofInstructions: z.string().min(1),
  outputFormat: z.string().min(1),
});

export const generatedQuestSchema = z.object({
  title: z.string().min(3).max(120),
  summary: z.string().min(10).max(300),
  description: z.string().min(20).max(4000),
  quest_type: z.enum(questGenerationTypes),
  difficulty: z.enum(["very_easy", "easy", "medium", "hard", "epic"]),
  estimated_duration_minutes: z.number().int().min(1).max(1440),
  recommended_points: z.number().int().min(1).max(1000),
  category: z.string().min(1).max(80),
  interest_tags: z.array(z.string().min(1).max(60)).max(10),
  objectives: z.array(z.string().min(1).max(500)).min(1).max(20),
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

const defaultText = (type: QuestGenerationType) =>
  type === "daily"
    ? "Create a short, safe, achievable Quest for an interest-aware Daily pool."
    : type === "monthly"
      ? "Create a varied, thematic Quest suitable for a Monthly Quest collection."
      : "Create a safe Quest concept grounded in the supplied public location context.";

const templates = new Map<QuestGenerationType, PromptVersion[]>(
  questGenerationTypes.map((type) => [type, [{
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
  }]]),
);

export function listPromptVersions(type?: QuestGenerationType) {
  return type ? templates.get(type) ?? [] : questGenerationTypes.flatMap((item) => templates.get(item) ?? []);
}

export function createPromptVersion(
  type: QuestGenerationType,
  input: z.input<typeof promptFields> & { changeReason: string; updatedBy: string },
) {
  const parsed = promptFields.parse(input);
  const versions = templates.get(type) ?? [];
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
  templates.set(type, versions);
  return version;
}

export function getActivePrompt(type: QuestGenerationType) {
  return (templates.get(type) ?? []).find((item) => item.active) ?? null;
}

export function aiConfiguration() {
  return {
    configured: Boolean(process.env.AI_API_KEY),
    provider: process.env.AI_PROVIDER ?? null,
    model: process.env.AI_MODEL ?? null,
  };
}

export function validatePromptVariables(template: string, supplied: Record<string, string>) {
  const variables = [...template.matchAll(/\{\{([a-z0-9_]+)\}\}/g)].map((match) => match[1]);
  const unknown = [...new Set(variables.filter((name) => !(name in supplied)))];
  const rendered = template.replace(/\{\{([a-z0-9_]+)\}\}/g, (_, name: string) => supplied[name] ?? `{{${name}}}`);
  return { variables: [...new Set(variables)], missing: unknown, rendered };
}

export async function generateQuest(type: QuestGenerationType, variables: Record<string, string>) {
  const config = aiConfiguration();
  const prompt = getActivePrompt(type);
  if (!config.configured || !prompt) {
    return { ok: false as const, status: "unavailable" as const, reason: "AI provider configuration is unavailable." };
  }
  const assembled = `${prompt.systemInstructions}\n${prompt.contentInstructions}\n${prompt.safetyInstructions}\n${prompt.outputFormat}\n${JSON.stringify(variables)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Number(process.env.AI_REQUEST_TIMEOUT_MS ?? 15000));
  try {
    const response = await fetch(process.env.AI_API_URL ?? "https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${process.env.AI_API_KEY}` },
      body: JSON.stringify({
        model: process.env.AI_MODEL,
        temperature: Number(process.env.AI_TEMPERATURE ?? 0.4),
        messages: [{ role: "system", content: assembled }],
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });
    if (!response.ok) return { ok: false as const, status: "failed" as const, reason: "The AI provider rejected the request." };
    const body = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = body.choices?.[0]?.message?.content;
    const parsed = generatedQuestSchema.safeParse(content ? JSON.parse(content) : null);
    if (!parsed.success) return { ok: false as const, status: "invalid" as const, reason: "The provider returned content that failed Quest validation." };
    if (parsed.data.quest_type !== type) return { ok: false as const, status: "invalid" as const, reason: "The provider returned the wrong Quest type." };
    return { ok: true as const, status: "candidate" as const, candidate: parsed.data };
  } catch {
    return { ok: false as const, status: "failed" as const, reason: "The AI provider could not be reached." };
  } finally {
    clearTimeout(timer);
  }
}