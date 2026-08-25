#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const failures = [];
const warnings = [];
const check = (label, condition, detail) => {
  (condition ? console.log : console.error)(`${condition ? "PASS" : "FAIL"} ${label}: ${detail}`);
  if (!condition) failures.push(`${label}: ${detail}`);
};

check("environment templates", existsSync("artifacts/mobile/.env.example") && existsSync("artifacts/api-server/.env.example"), "public and server templates are present");
const mobileEnv = readFileSync("artifacts/mobile/.env.example", "utf8");
const serverEnv = readFileSync("artifacts/api-server/.env.example", "utf8");
const activeLines = (text) => text.split(/\r?\n/).filter((line) => /^\s*[A-Z][A-Z0-9_]*=/.test(line));
check("server-only boundary", !activeLines(mobileEnv).some((line) => line.startsWith("SUPABASE_SERVICE_ROLE_KEY=")), "service-role credentials are not declared in the mobile template");
check("server-only template", activeLines(serverEnv).some((line) => line.startsWith("SUPABASE_SERVICE_ROLE_KEY=")) && !activeLines(serverEnv).some((line) => line.startsWith("EXPO_PUBLIC_")), "server template contains no Expo-public variables");
check("development-stub guard", !serverEnv.includes("MODERATION_STUB_DECISION="), "production server template does not enable moderation stubs");
const mobileAppConfig = JSON.parse(readFileSync("artifacts/mobile/app.json", "utf8"));
const expoConfig = mobileAppConfig.expo ?? {};
const hasIosAssociatedDomain = expoConfig.ios?.associatedDomains?.includes("applinks:matterrealm.com");
const hasAndroidHttpsIntent = expoConfig.android?.intentFilters?.some((filter) =>
  filter.action === "VIEW"
  && filter.autoVerify === true
  && Array.isArray(filter.category)
  && filter.category.includes("BROWSABLE")
  && filter.category.includes("DEFAULT")
  && filter.data?.some((data) =>
    data.scheme === "https"
    && data.host === "matterrealm.com"
    && data.pathPrefix === "/auth/callback"
  )
);
check(
  "signed-native link declarations",
  hasIosAssociatedDomain && hasAndroidHttpsIntent,
  "static config declares applinks:matterrealm.com and an auto-verified Android HTTPS auth callback intent; signed-device association verification remains an external release check",
);

const commands = [
  ["mobile typecheck", ["--filter", "@workspace/mobile", "run", "typecheck"]],
  ["mobile tests", ["--filter", "@workspace/mobile", "exec", "jest", "--runInBand"]],
  ["mobile export", ["--filter", "@workspace/mobile", "run", "build"]],
  ["admin typecheck", ["--filter", "@workspace/worlds-admin", "run", "typecheck"]],
  ["api typecheck", ["--filter", "@workspace/api-server", "run", "typecheck"]],
  ["api build", ["--filter", "@workspace/api-server", "run", "build"]],
  ["worker artifact", ["--filter", "@workspace/api-server", "exec", "test", "-e", "dist/worker.mjs"]],
  ["admin build", ["--filter", "@workspace/worlds-admin", "run", "build"]],
];
for (const [label, args] of commands) {
  try {
    execFileSync("pnpm", args, { stdio: "inherit", env: { ...process.env, NODE_ENV: "test", PORT: process.env.PORT ?? "3000", BASE_PATH: process.env.BASE_PATH ?? "/", EXPO_METRO_PORT: process.env.EXPO_METRO_PORT ?? "8099" } });
    console.log(`PASS ${label}`);
  } catch {
    failures.push(`${label}: command failed`);
    console.error(`FAIL ${label}: command failed`);
  }
}

if (!process.env.EXPO_PUBLIC_SUPABASE_URL || !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) warnings.push("Supabase mobile credentials are not configured; live Auth/DB checks are blocked.");
if (!process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN) warnings.push("Mapbox public token is not configured; native map checks are blocked.");
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) warnings.push("Server Supabase credentials are not configured; trusted DB/storage/job checks are blocked.");
if (!process.env.EXPO_ACCESS_TOKEN) warnings.push("Expo push credentials are not configured; delivery checks are blocked.");
for (const warning of warnings) console.warn(`BLOCKED ${warning}`);

if (failures.length) {
  console.error(`\n${failures.length} readiness check(s) failed.`);
  process.exitCode = 1;
} else {
  console.log(`\nReadiness checks passed locally; ${warnings.length} external check(s) remain blocked or owner-dependent.`);
}