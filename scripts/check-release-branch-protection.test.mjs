import test from "node:test";
import assert from "node:assert/strict";

import {
  ADVISORY_STATUS_CHECKS,
  REQUIRED_STATUS_CHECK,
  evaluateProtection,
  runReleaseBranchProtectionCheck,
} from "./check-release-branch-protection.mjs";

test("accepts the exact check from classic branch protection", () => {
  const result = evaluateProtection({
    classicProtection: {
      contexts: [REQUIRED_STATUS_CHECK],
      checks: [{ context: REQUIRED_STATUS_CHECK, app_id: -1 }],
    },
    rules: null,
  });

  assert.equal(result.ok, true);
  assert.match(result.message, /classic branch protection/);
});

test("accepts the exact check from effective ruleset data", () => {
  const result = evaluateProtection({
    classicProtection: null,
    rules: {
      rules: [
        {
          type: "required_status_checks",
          parameters: {
            required_status_checks: [{ context: REQUIRED_STATUS_CHECK }],
          },
        },
      ],
    },
  });

  assert.equal(result.ok, true);
  assert.match(result.message, /effective branch rules/);
});

test("rejects a renamed or missing check with the found checks", () => {
  const result = evaluateProtection({
    classicProtection: {
      contexts: ["Quest database contracts"],
    },
    rules: [],
  });

  assert.equal(result.ok, false);
  assert.match(result.message, /Quest RPC and RLS contracts/);
  assert.match(result.message, /Quest database contracts/);
  assert.match(result.message, /Restore the workflow job name/);
});

test("rejects an advisory candidate instead of treating it as the release gate", () => {
  const advisory = ADVISORY_STATUS_CHECKS[0];
  const result = evaluateProtection({
    classicProtection: {
      checks: [{ context: advisory }],
    },
    rules: null,
  });

  assert.equal(result.ok, false);
  assert.match(result.message, /advisory candidate check/);
  assert.match(result.message, /must not replace it/);
});

test("fails closed when GitHub authorization cannot read protection", () => {
  assert.throws(
    () =>
      runReleaseBranchProtectionCheck({
        repository: "example/worlds",
        api: () => {
          throw new Error("HTTP 403: Resource not accessible by integration");
        },
      }),
    /Resource not accessible by integration/,
  );
});