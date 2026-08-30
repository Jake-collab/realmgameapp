import { z } from "zod";

const optionalUrl = z.string().url().optional();

const serverEnvironmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive(),
  SUPABASE_URL: optionalUrl,
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  AI_PROVIDER: z.string().min(1).default("openai-compatible"),
  AI_API_URL: optionalUrl,
  AI_API_KEY: z.string().min(1).optional(),
  AI_MODEL: z.string().min(1).optional(),
  MODERATION_PROVIDER: z.string().min(1).default("manual"),
  MODERATION_AUTOMATION_ENABLED: z.enum(["true", "false"]).default("false"),
  MODERATION_API_URL: optionalUrl,
  MODERATION_API_KEY: z.string().min(1).optional(),
  MODERATION_AUTO_APPROVAL_MODE: z.enum(["manual_only", "low_risk", "mixed"]).default("manual_only"),
  EXPO_ACCESS_TOKEN: z.string().min(1).optional(),
  CORS_ORIGINS: z.string().optional(),
  SCHEDULER_ENABLED: z.enum(["true", "false"]).default("false"),
  SCHEDULER_INTERVAL_SECONDS: z.coerce.number().int().positive().default(60),
  SCHEDULER_MAINTENANCE_INTERVAL_SECONDS: z.coerce.number().int().positive().default(3600),
  MODERATION_MEDIA_RETENTION_DAYS: z.coerce.number().int().positive().default(30),
});

export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>;

export function readServerEnvironment(raw: NodeJS.ProcessEnv = process.env): ServerEnvironment {
  const result = serverEnvironmentSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => `${issue.path.join(".") || "environment"}: ${issue.message}`);
    throw new Error(`Invalid server configuration: ${issues.join("; ")}`);
  }
  if (result.data.NODE_ENV === "production") {
    if (!result.data.SUPABASE_URL || !result.data.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Production requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
    }
    if (result.data.MODERATION_AUTOMATION_ENABLED === "true" && !result.data.MODERATION_API_KEY) {
      throw new Error("Production moderation automation requires MODERATION_API_KEY.");
    }
  }
  return result.data;
}

export type ReadinessStatus = "ready" | "degraded" | "disabled" | "missing_config" | "failed";

export type ReadinessCheck = {
  name: string;
  status: ReadinessStatus;
  summary: string;
};

const configured = (condition: boolean, summary: string, optional = true): Omit<ReadinessCheck, "name"> => ({
  status: condition ? "ready" : optional ? "disabled" : "missing_config",
  summary,
});

export function serverReadiness(raw: NodeJS.ProcessEnv = process.env): {
  environment: "development" | "test" | "production";
  checks: ReadinessCheck[];
  status: "ready" | "degraded" | "failed";
} {
  const env = readServerEnvironment(raw);
  const supabase = Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
  const ai = Boolean(env.AI_API_KEY && env.AI_MODEL);
  const moderation = env.MODERATION_AUTOMATION_ENABLED === "true"
    ? Boolean(env.MODERATION_API_KEY)
    : false;
  const push = Boolean(env.EXPO_ACCESS_TOKEN);
  const checks: ReadinessCheck[] = [
    { name: "Supabase trusted access", ...configured(supabase, supabase ? "Server credentials are configured; live connectivity is not tested by this check." : "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for trusted operations.", false) },
    { name: "AI generation", ...configured(ai, ai ? "Provider credentials are configured; generation is still draft-only." : "AI is disabled until AI_API_KEY and AI_MODEL are configured.") },
    { name: "Automated moderation", ...configured(moderation, moderation ? "Automation is configured; human review remains authoritative." : env.MODERATION_AUTOMATION_ENABLED === "true" ? "Automation is enabled but provider credentials are incomplete." : "Manual moderation mode is active.") },
    { name: "Push delivery", ...configured(push, push ? "Expo server credentials are configured; device delivery requires a native build." : "Push delivery is disabled until EXPO_ACCESS_TOKEN is configured.") },
    {
      name: "Scheduled jobs",
      status: env.SCHEDULER_ENABLED === "true" && supabase ? "ready" : "missing_config",
      summary: env.SCHEDULER_ENABLED === "true" && supabase
        ? `Trusted worker enabled; due jobs run every ${env.SCHEDULER_INTERVAL_SECONDS}s and maintenance runs every ${env.SCHEDULER_MAINTENANCE_INTERVAL_SECONDS}s.`
        : "Set SCHEDULER_ENABLED=true with trusted Supabase credentials and run the worker command.",
    },
  ];
  const requiredMissing = checks.some((check) => check.status === "missing_config");
  return {
    environment: env.NODE_ENV,
    checks,
    status: requiredMissing ? "failed" : checks.some((check) => check.status !== "ready") ? "degraded" : "ready",
  };
}

export function corsOrigins(raw: string | undefined = process.env.CORS_ORIGINS): string[] {
  return (raw ?? "").split(",").map((origin) => origin.trim()).filter(Boolean);
}