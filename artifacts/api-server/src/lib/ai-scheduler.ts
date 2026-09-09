import { createHash } from "node:crypto";
import { generateQuest, questGenerationTypes, type QuestGenerationType } from "./ai-quest";
import {
  readDurableAiConfiguration,
} from "./ai-quest-persistence";
import { supabaseAdminConfigured, supabaseAdminRequest } from "./supabase-admin";

type SchedulerJob = {
  id: string;
  job_key: string;
  job_type: string;
  payload: Record<string, unknown>;
  status: string;
  attempt_count: number;
  max_attempts: number;
};

function keyFor(type: "daily" | "monthly", now = new Date()) {
  return type === "daily"
    ? `quest-generation:daily:${now.toISOString().slice(0, 10)}`
    : `quest-generation:monthly:${now.toISOString().slice(0, 7)}`;
}

async function insertScheduleJob(jobKey: string, type: QuestGenerationType, payload: Record<string, unknown>) {
  await supabaseAdminRequest("ai_scheduler_jobs?on_conflict=job_key", {
    method: "POST",
    headers: { prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify({
      job_key: jobKey,
      job_type: "quest_generation",
      payload: { type, variables: payload },
      idempotency_key: jobKey,
      available_at: new Date().toISOString(),
    }),
  });
}

async function defaultDailyInterests() {
  const rows = await supabaseAdminRequest<Array<{ id: string }>>(
    "interests?select=id&is_active=eq.true&order=sort_order.asc&limit=3",
  );
  return rows.map((row) => row.id);
}

async function completeJob(job: SchedulerJob, status: "succeeded" | "failed", error?: string) {
  await supabaseAdminRequest(`ai_scheduler_jobs?id=eq.${encodeURIComponent(job.id)}`, {
    method: "PATCH",
    headers: { prefer: "return=minimal" },
    body: JSON.stringify({
      status,
      lease_owner: null,
      lease_expires_at: null,
      last_error_code: status === "failed" ? "generation_failed" : null,
      last_error_message: status === "failed" ? error?.slice(0, 500) ?? "Generation failed." : null,
      updated_at: new Date().toISOString(),
    }),
  });
}

async function processJob(job: SchedulerJob, workerId: string) {
  const leaseUntil = new Date(Date.now() + 120_000).toISOString();
  const claimed = await supabaseAdminRequest<Array<SchedulerJob>>(
    `ai_scheduler_jobs?id=eq.${encodeURIComponent(job.id)}&status=eq.queued`,
    {
      method: "PATCH",
      headers: { prefer: "return=representation" },
      body: JSON.stringify({
        status: "leased",
        lease_owner: workerId,
        lease_expires_at: leaseUntil,
        attempt_count: job.attempt_count + 1,
        updated_at: new Date().toISOString(),
      }),
    },
  );
  if (!claimed[0]) return;
  const payload = job.payload?.variables;
  const type = payload && typeof payload === "object" && "type" in payload ? payload.type : null;
  const variables = payload && typeof payload === "object" && "variables" in payload ? payload.variables : null;
  if (!questGenerationTypes.includes(type as QuestGenerationType) || !variables || typeof variables !== "object") {
    await completeJob(job, "failed", "Invalid durable Quest-generation job payload.");
    return;
  }
  const result = await generateQuest(type as QuestGenerationType, variables as Record<string, string>, "scheduler");
  if (!result.ok) {
    await completeJob(job, "failed", result.reason);
    return;
  }
  await supabaseAdminRequest("ai_generated_content", {
    method: "POST",
    headers: { prefer: "return=minimal" },
    body: JSON.stringify({
      content_type: "quest",
      output_draft: result.candidate,
      suggested_points: result.candidate.recommended_points,
      approval_status: "pending_review",
    }),
  });
  await completeJob(job, "succeeded");
}

export async function runAiSchedulerCycle(workerId: string) {
  if (!supabaseAdminConfigured()) return { enabled: false, reason: "supabase_unavailable", processed: 0 };
  const configs = await readDurableAiConfiguration().catch(() => null);
  const global = configs?.find((row) => row.lane === "global")?.config;
  if (!global?.automatedGenerationEnabled || global.generationEnabled === false) {
    return { enabled: false, reason: "automation_disabled", processed: 0 };
  }

  const now = new Date();
  const dailyInterests = await defaultDailyInterests();
  if (dailyInterests.length) {
    await insertScheduleJob(keyFor("daily", now), "daily", {
      current_date: now.toISOString().slice(0, 10),
      interest_bubble_ids: JSON.stringify(dailyInterests),
    });
  }
  await insertScheduleJob(keyFor("monthly", now), "monthly", {
    current_date: now.toISOString().slice(0, 10),
    theme: "Seasonal Worlds challenge",
    target_month: now.toISOString().slice(0, 7),
  });

  const jobs = await supabaseAdminRequest<SchedulerJob[]>(
    "ai_scheduler_jobs?job_type=eq.quest_generation&status=eq.queued&available_at=lte." +
      encodeURIComponent(now.toISOString()) +
      "&order=available_at.asc&limit=4",
  );
  let processed = 0;
  for (const job of jobs) {
    await processJob(job, workerId).catch(async (error: unknown) => {
      await completeJob(job, "failed", error instanceof Error ? error.message : "Scheduler job failed.");
    });
    processed += 1;
  }
  return { enabled: true, processed };
}

export function schedulerJobFingerprint(type: QuestGenerationType, variables: Record<string, string>) {
  return createHash("sha256").update(`${type}:${JSON.stringify(variables)}`).digest("hex");
}