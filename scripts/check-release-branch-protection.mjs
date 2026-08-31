#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

export const RELEASE_BRANCH = "main";
export const REQUIRED_STATUS_CHECK = "Quest RPC and RLS contracts";
export const ADVISORY_STATUS_CHECKS = [
  "Candidate Supabase CLI compatibility",
  "Report candidate Supabase CLI incompatibility",
];

const GITHUB_API_HEADER = "Accept: application/vnd.github+json";

function commandErrorText(error) {
  if (!error || typeof error !== "object") return String(error);
  const candidate = [error.stderr, error.stdout, error.message].find(
    (value) => typeof value === "string" && value.trim(),
  );
  return candidate?.replace(/\s+/g, " ").trim() ?? "unknown command error";
}

function isNotFound(error) {
  return /(?:HTTP )?404\b|Not Found/i.test(commandErrorText(error));
}

function ghApi(endpoint) {
  try {
    const output = execFileSync(
      "gh",
      ["api", endpoint, "--header", GITHUB_API_HEADER],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    return { found: true, data: JSON.parse(output) };
  } catch (error) {
    if (isNotFound(error)) return { found: false, data: null };
    throw new Error(
      `GitHub API request failed for ${endpoint}: ${commandErrorText(error)}. Authenticate gh with repository Administration: read access; the workflow GITHUB_TOKEN cannot read classic branch protection.`,
    );
  }
}

function repositoryFromEnvironment() {
  const configuredRepository =
    process.env.GITHUB_REPOSITORY ?? process.env.GH_REPO;
  if (configuredRepository) return configuredRepository;

  try {
    return execFileSync(
      "gh",
      ["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    ).trim();
  } catch (error) {
    throw new Error(
      `Could not determine the GitHub repository. Set GITHUB_REPOSITORY or GH_REPO, or authenticate gh with repository Administration: read access. ${commandErrorText(error)}`,
    );
  }
}

function assertRepository(repository) {
  if (!/^[^/]+\/[^/]+$/.test(repository)) {
    throw new Error(
      `Invalid GitHub repository "${repository}". Expected the owner/name form, for example questworldapp/worlds.`,
    );
  }
}

function checkName(value) {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return null;
  if (typeof value.context === "string") return value.context;
  if (typeof value.name === "string") return value.name;
  return null;
}

function namesFromValues(values) {
  if (!Array.isArray(values)) return [];
  return values.map(checkName).filter((name) => name !== null);
}

function namesFromRequiredStatusRule(rule) {
  if (!rule || typeof rule !== "object" || rule.type !== "required_status_checks") {
    return [];
  }

  const parameters =
    rule.parameters && typeof rule.parameters === "object"
      ? rule.parameters
      : rule;
  return namesFromValues(parameters.required_status_checks);
}

function namesFromClassicProtection(protection) {
  if (!protection || typeof protection !== "object") return [];
  const requiredStatusChecks =
    protection.required_status_checks &&
    typeof protection.required_status_checks === "object"
      ? protection.required_status_checks
      : protection;

  return [
    ...namesFromValues(requiredStatusChecks.contexts),
    ...namesFromValues(requiredStatusChecks.checks),
  ];
}

function namesFromRulesPayload(payload) {
  if (Array.isArray(payload)) {
    return payload.flatMap(namesFromRequiredStatusRule);
  }
  if (!payload || typeof payload !== "object") return [];

  const rules = Array.isArray(payload.rules) ? payload.rules : [];
  const rulesets = Array.isArray(payload.rulesets) ? payload.rulesets : [];
  return [
    ...rules.flatMap(namesFromRequiredStatusRule),
    ...rulesets.flatMap((ruleset) =>
      Array.isArray(ruleset?.rules)
        ? ruleset.rules.flatMap(namesFromRequiredStatusRule)
        : [],
    ),
  ];
}

function unique(values) {
  return [...new Set(values)];
}

export function evaluateProtection({ classicProtection, rules }) {
  const classicChecks = unique(namesFromClassicProtection(classicProtection));
  const rulesetChecks = unique(namesFromRulesPayload(rules));
  const foundChecks = unique([...classicChecks, ...rulesetChecks]);
  const foundAdvisoryChecks = ADVISORY_STATUS_CHECKS.filter((check) =>
    foundChecks.includes(check),
  );
  const sourceLabels = [
    classicChecks.includes(REQUIRED_STATUS_CHECK)
      ? "classic branch protection"
      : null,
    rulesetChecks.includes(REQUIRED_STATUS_CHECK) ? "effective branch rules" : null,
  ].filter(Boolean);

  if (sourceLabels.length > 0) {
    return {
      ok: true,
      foundChecks,
      sourceLabels,
      message: `Protected ${RELEASE_BRANCH} requires "${REQUIRED_STATUS_CHECK}" via ${sourceLabels.join(" and ")}.`,
    };
  }

  const found =
    foundChecks.length > 0 ? foundChecks.join(", ") : "no required checks";
  const advisory =
    foundAdvisoryChecks.length > 0
      ? ` The advisory candidate check(s) ${foundAdvisoryChecks.map((check) => `"${check}"`).join(" and ")} must not replace it.`
      : "";
  return {
    ok: false,
    foundChecks,
    sourceLabels: [],
    message: `Protected ${RELEASE_BRANCH} is missing the exact required status check "${REQUIRED_STATUS_CHECK}" (found: ${found}).${advisory} Restore the workflow job name and update the main branch protection rule or ruleset before publishing.`,
  };
}

export function runReleaseBranchProtectionCheck({
  repository = repositoryFromEnvironment(),
  api = ghApi,
} = {}) {
  assertRepository(repository);
  const classicProtection = api(
    `repos/${repository}/branches/${RELEASE_BRANCH}/protection/required_status_checks`,
  );
  const rules = api(`repos/${repository}/rules/branches/${RELEASE_BRANCH}`);
  const result = evaluateProtection({
    classicProtection: classicProtection.found ? classicProtection.data : null,
    rules: rules.found ? rules.data : null,
  });

  return {
    ...result,
    repository,
    sourcesChecked: [
      "classic branch protection",
      "effective branch rules",
    ],
  };
}

export function main() {
  try {
    const result = runReleaseBranchProtectionCheck();
    if (!result.ok) {
      console.error(`FAIL release branch protection: ${result.message}`);
      process.exitCode = 1;
      return;
    }
    console.log(`PASS release branch protection: ${result.message}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`FAIL release branch protection: ${message}`);
    process.exitCode = 1;
  }
}

const thisFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === thisFile) {
  main();
}