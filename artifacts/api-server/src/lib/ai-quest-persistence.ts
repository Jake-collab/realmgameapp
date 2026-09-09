import { createHash } from "node:crypto";
import {
  supabaseAdminConfigured,
  supabaseAdminRequest,
  supabaseAdminRpc,
} from "./supabase-admin";
import type { GeneratedQuest, GenerationHistoryItem, PromptVersion, QuestGenerationType } from "./ai-quest";

function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export async function persistGenerationAttempt(
  item: GenerationHistoryItem,
  variables: Record<string, string>,
  candidate?: GeneratedQuest,
) {
  if (!supabaseAdminConfigured()) return { persisted: false as const, reason: "supabase_unavailable" };
  try {
    await supabaseAdminRequest("ai_quest_generation_attempts", {
      method: "POST",
      headers: { prefer: "resolution=ignore-duplicates,return=minimal" },
      body: JSON.stringify({
        idempotency_key: item.id,
        lane: item.type,
        status: item.status === "candidate" ? "succeeded" : item.status === "rate_limited" ? "cancelled" : "failed",
        provider: process.env.AI_PROVIDER ?? "nvidia",
        model: process.env.AI_MODEL ?? "nvidia/nemotron-3.5-lightning-30b-a3b",
        config_version: item.promptVersion,
        attempt_count: item.attemptCount,
        input_digest: digest(variables),
        output_digest: candidate ? digest(candidate) : null,
        error_code: item.status === "candidate" ? null : item.status,
        error_message: item.reason ?? null,
        started_at: item.createdAt,
        completed_at: new Date().toISOString(),
      }),
    });
    return { persisted: true as const };
  } catch (error) {
    return {
      persisted: false as const,
      reason: error instanceof Error ? error.message : "persistence_failed",
    };
  }
}

export async function listDurableGenerationAttempts() {
  if (!supabaseAdminConfigured()) return null;
  return supabaseAdminRequest<Array<Record<string, unknown>>>(
    "ai_quest_generation_attempts?select=id,lane,status,provider,model,config_version,error_code,error_message,started_at,completed_at,created_at&order=created_at.desc&limit=500",
  );
}

export async function persistPromptVersion(version: PromptVersion) {
  if (!supabaseAdminConfigured()) return { persisted: false as const, reason: "supabase_unavailable" };
  try {
    await supabaseAdminRequest("ai_generation_prompt_versions", {
      method: "POST",
      headers: { prefer: "return=minimal" },
      body: JSON.stringify({
        lane: version.type,
        version: version.version,
        prompt: {
          systemInstructions: version.systemInstructions,
          contentInstructions: version.contentInstructions,
          safetyInstructions: version.safetyInstructions,
          pointInstructions: version.pointInstructions,
          proofInstructions: version.proofInstructions,
          outputFormat: version.outputFormat,
        },
        active: version.active,
        changed_by: version.updatedBy,
        change_reason: version.changeReason,
        created_at: version.createdAt,
      }),
    });
    return { persisted: true as const };
  } catch (error) {
    return { persisted: false as const, reason: error instanceof Error ? error.message : "persistence_failed" };
  }
}

export async function updateDurablePromptActivation(
  type: QuestGenerationType,
  version: number,
  active: boolean,
) {
  if (!supabaseAdminConfigured()) return { persisted: false as const, reason: "supabase_unavailable" };
  try {
    await supabaseAdminRequest(
      `ai_generation_prompt_versions?lane=eq.${encodeURIComponent(type)}`,
      {
        method: "PATCH",
        headers: { prefer: "return=minimal" },
        body: JSON.stringify({ active: false }),
      },
    );
    await supabaseAdminRequest(
      `ai_generation_prompt_versions?lane=eq.${encodeURIComponent(type)}&version=eq.${version}`,
      {
        method: "PATCH",
        headers: { prefer: "return=minimal" },
        body: JSON.stringify({ active }),
      },
    );
    return { persisted: true as const };
  } catch (error) {
    return { persisted: false as const, reason: error instanceof Error ? error.message : "persistence_failed" };
  }
}

export async function loadDurablePromptVersions() {
  if (!supabaseAdminConfigured()) return null;
  const rows = await supabaseAdminRequest<Array<{
    lane: QuestGenerationType;
    version: number;
    prompt: Partial<PromptVersion>;
    active: boolean;
    changed_by: string | null;
    change_reason: string;
    created_at: string;
  }>>("ai_generation_prompt_versions?select=lane,version,prompt,active,changed_by,change_reason,created_at&order=lane.asc,version.asc");
  return rows;
}

export async function readDurableAiConfiguration() {
  if (!supabaseAdminConfigured()) return null;
  return supabaseAdminRequest<Array<{ lane: string; config: Record<string, unknown>; version: number; changed_by: string | null; changed_at: string }>>(
    "ai_generation_config?select=lane,config,version,changed_by,changed_at&order=lane.asc",
  );
}

export async function writeDurableAiConfiguration(
  lane: string,
  config: Record<string, unknown>,
  changedBy: string,
) {
  if (!supabaseAdminConfigured()) return { persisted: false as const, reason: "supabase_unavailable" };
  try {
    const current = await supabaseAdminRequest<Array<{ version: number }>>(
      `ai_generation_config?lane=eq.${encodeURIComponent(lane)}&select=version&limit=1`,
    );
    const version = (current[0]?.version ?? 0) + 1;
    await supabaseAdminRequest("ai_generation_config?on_conflict=lane", {
      method: "POST",
      headers: { prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ lane, config, version, changed_by: changedBy, changed_at: new Date().toISOString() }),
    });
    return { persisted: true as const, version };
  } catch (error) {
    return { persisted: false as const, reason: error instanceof Error ? error.message : "persistence_failed" };
  }
}

export async function promoteAiQuestDraft(
  contentId: string,
  adminId: string,
  geoContext?: Record<string, unknown>,
) {
  return supabaseAdminRpc<string>("promote_ai_quest_draft", {
    p_content_id: contentId,
    p_admin_id: adminId,
    p_geo_context: geoContext ?? null,
  });
}

export async function publishQuest(questId: string, adminId: string) {
  const rows = await supabaseAdminRequest<Array<Record<string, unknown>>>(
    `quests?id=eq.${encodeURIComponent(questId)}&select=id,status,quest_type,source_type`,
    { method: "GET" },
  );
  const current = rows[0];
  if (!current) throw new Error("Quest was not found.");
  if (current.status === "published") return current;
  if (current.status !== "draft") throw new Error("Only draft Quests can be published.");
  const updated = await supabaseAdminRequest<Array<Record<string, unknown>>>(
    `quests?id=eq.${encodeURIComponent(questId)}`,
    {
      method: "PATCH",
      headers: { prefer: "return=representation" },
      body: JSON.stringify({
        status: "published",
        published_at: new Date().toISOString(),
        approved_by: adminId,
      }),
    },
  );
  return updated[0] ?? null;
}