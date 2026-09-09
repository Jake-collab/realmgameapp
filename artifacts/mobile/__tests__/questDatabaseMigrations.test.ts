// @ts-nocheck
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  getCanonicalMigrations,
} = require("../scripts/validate-supabase-migrations.js");

function withMigrationFixture(files, callback) {
  const migrationsDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "quest-migrations-"),
  );

  try {
    for (const file of files) {
      fs.writeFileSync(path.join(migrationsDir, file), "-- fixture\n");
    }
    return callback(migrationsDir);
  } finally {
    fs.rmSync(migrationsDir, { recursive: true, force: true });
  }
}

function withLinkedVerificationFixture(
  files,
  callback,
  migrationResponse = '{"migrations":[]}\n',
) {
  const fixtureRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "linked-supabase-verification-"),
  );
  const mobileDir = path.join(fixtureRoot, "mobile");
  const scriptsDir = path.join(mobileDir, "scripts");
  const migrationsDir = path.join(mobileDir, "supabase", "migrations");
  const metadataDir = path.join(mobileDir, "supabase", ".temp");
  const binDir = path.join(fixtureRoot, "bin");
  const migrationResponsePath = path.join(
    fixtureRoot,
    "migration-response.json",
  );

  fs.mkdirSync(scriptsDir, { recursive: true });
  fs.mkdirSync(migrationsDir, { recursive: true });
  fs.mkdirSync(metadataDir, { recursive: true });
  fs.mkdirSync(binDir, { recursive: true });
  fs.copyFileSync(
    path.resolve(__dirname, "../scripts/verify-linked-supabase.sh"),
    path.join(scriptsDir, "verify-linked-supabase.sh"),
  );
  fs.copyFileSync(
    path.resolve(__dirname, "../scripts/validate-supabase-migrations.js"),
    path.join(scriptsDir, "validate-supabase-migrations.js"),
  );
  fs.writeFileSync(path.join(metadataDir, "project-ref"), "fixture-project\n");
  fs.writeFileSync(migrationResponsePath, migrationResponse);
  for (const file of files) {
    fs.writeFileSync(path.join(migrationsDir, file), "-- fixture\n");
  }

  const fakeNpxPath = path.join(binDir, "npx");
  fs.writeFileSync(
    fakeNpxPath,
    `#!/usr/bin/env bash
case "$*" in
  *"migration list --linked"*)
    cat "${migrationResponsePath}"
    ;;
  *)
    echo "Unexpected fake Supabase command: $*" >&2
    exit 1
    ;;
esac
`,
    { mode: 0o755 },
  );

  try {
    return callback({
      env: {
        ...process.env,
        PATH: `${binDir}:${process.env.PATH}`,
        SUPABASE_DB_PASSWORD: "fixture-password",
      },
      scriptPath: path.join(scriptsDir, "verify-linked-supabase.sh"),
    });
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
}

describe("Supabase migration filename preflight", () => {
  test("accepts a valid migration history in canonical order", () => {
    withMigrationFixture(
      ["002_second.sql", "001_first.sql", "003_third.sql"],
      (migrationsDir) => {
        expect(getCanonicalMigrations(migrationsDir)).toEqual([
          { file: "001_first.sql", version: "001" },
          { file: "002_second.sql", version: "002" },
          { file: "003_third.sql", version: "003" },
        ]);
      },
    );
  });

  test("rejects duplicate version prefixes", () => {
    withMigrationFixture(
      ["001_first.sql", "001_second.sql"],
      (migrationsDir) => {
        expect(() => getCanonicalMigrations(migrationsDir)).toThrow(
          "Duplicate canonical migration version 001",
        );
      },
    );
  });

  test("rejects malformed version prefixes", () => {
    withMigrationFixture(["1_first.sql"], (migrationsDir) => {
      expect(() => getCanonicalMigrations(migrationsDir)).toThrow(
        "Migration filename must start with a three-digit version",
      );
    });
  });

  test("reports concise actionable errors from the CLI", () => {
    const validatorPath = path.resolve(
      __dirname,
      "../scripts/validate-supabase-migrations.js",
    );

    withMigrationFixture(
      ["001_first.sql", "001_second.sql"],
      (migrationsDir) => {
      const result = childProcess.spawnSync(
        process.execPath,
        [validatorPath, migrationsDir],
        { encoding: "utf8" },
      );

        expect(result.status).toBe(1);
        expect(result.stderr).toContain(
          "Migration filename preflight failed:",
        );
        expect(result.stderr).toContain(
          "Duplicate canonical migration version 001: 001_first.sql and 001_second.sql.",
        );
        expect(result.stderr).toContain("Rename one file");
        expect(result.stderr).not.toContain("at getCanonicalMigrations");
        expect(result.stderr).not.toContain("Error:");
      },
    );

    withMigrationFixture(["1_first.sql"], (migrationsDir) => {
      const result = childProcess.spawnSync(
        process.execPath,
        [validatorPath, migrationsDir],
        { encoding: "utf8" },
      );

      expect(result.status).toBe(1);
      expect(result.stderr).toContain(
        "Migration filename preflight failed:",
      );
      expect(result.stderr).toContain(
        "NNN_description.sql (for example, 001_create_users.sql)",
      );
      expect(result.stderr).toContain("1_first.sql");
      expect(result.stderr).not.toContain("at getCanonicalMigrations");
      expect(result.stderr).not.toContain("Error:");
    });
  });

  test("reports concise actionable errors from linked verification", () => {
    withLinkedVerificationFixture(
      ["001_first.sql", "001_second.sql"],
      ({ env, scriptPath }) => {
        const result = childProcess.spawnSync(
          "bash",
          [scriptPath],
          { encoding: "utf8", env },
        );

        expect(result.status).toBe(1);
        expect(result.stderr).toContain(
          "Migration filename preflight failed:",
        );
        expect(result.stderr).toContain(
          "Duplicate canonical migration version 001: 001_first.sql and 001_second.sql.",
        );
        expect(result.stderr).toContain("Rename one file");
        expect(result.stderr).not.toContain("at getCanonicalMigrations");
        expect(result.stderr).not.toContain("Error:");
      },
    );

    withLinkedVerificationFixture(["1_first.sql"], ({ env, scriptPath }) => {
      const result = childProcess.spawnSync(
        "bash",
        [scriptPath],
        { encoding: "utf8", env },
      );

      expect(result.status).toBe(1);
      expect(result.stderr).toContain(
        "Migration filename preflight failed:",
      );
      expect(result.stderr).toContain(
        "NNN_description.sql (for example, 001_create_users.sql)",
      );
      expect(result.stderr).toContain("1_first.sql");
      expect(result.stderr).not.toContain("at getCanonicalMigrations");
      expect(result.stderr).not.toContain("Error:");
    });
  });

  test("rejects malformed linked migration JSON without a Node stack trace", () => {
    withLinkedVerificationFixture(
      ["001_first.sql"],
      ({ env, scriptPath }) => {
        const result = childProcess.spawnSync(
          "bash",
          [scriptPath],
          { encoding: "utf8", env },
        );

        expect(result.status).toBe(1);
        expect(result.stderr).toContain(
          "Migration filename preflight failed:",
        );
        expect(result.stderr).toContain("Unexpected token");
        expect(result.stderr).not.toMatch(/\n\s+at /);
        expect(result.stderr).not.toContain("Error:");
      },
      '{"migrations":[}\n',
    );
  });

  test("rejects a linked migration list whose migrations field is not an array", () => {
    withLinkedVerificationFixture(
      ["001_first.sql"],
      ({ env, scriptPath }) => {
        const result = childProcess.spawnSync(
          "bash",
          [scriptPath],
          { encoding: "utf8", env },
        );

        expect(result.status).toBe(1);
        expect(result.stderr).toContain(
          "Migration filename preflight failed:",
        );
        expect(result.stderr).toContain(
          "Supabase CLI returned an invalid migration list.",
        );
        expect(result.stderr).not.toMatch(/\n\s+at /);
        expect(result.stderr).not.toContain("Error:");
      },
      '{"migrations":{"version":"001"}}\n',
    );
  });

  test.each([
    [
      "local",
      '{"migrations":[{"remote":"001"}]}\n',
      "local <none>, remote 001",
    ],
    [
      "remote",
      '{"migrations":[{"local":"001"}]}\n',
      "local 001, remote <none>",
    ],
  ])(
    "rejects a linked migration entry with a missing %s version",
    (_versionType, migrationResponse, receivedVersions) => {
      withLinkedVerificationFixture(
        ["001_first.sql"],
        ({ env, scriptPath }) => {
          const result = childProcess.spawnSync(
            "bash",
            [scriptPath],
            { encoding: "utf8", env },
          );

          expect(result.status).toBe(1);
          expect(result.stderr).toContain(
            "Migration filename preflight failed:",
          );
          expect(result.stderr).toContain(
            `Migration parity mismatch at position 1: expected 001, received ${receivedVersions}.`,
          );
          expect(result.stderr).not.toMatch(/\n\s+at /);
          expect(result.stderr).not.toContain("Error:");
        },
        migrationResponse,
      );
    },
  );

  test("the disposable check preflights before Supabase provisioning", () => {
    const checkSource = fs.readFileSync(
      path.resolve(__dirname, "../scripts/quest-database-check.sh"),
      "utf8",
    );

    expect(checkSource).toContain(
      'node "$SCRIPT_DIR/validate-supabase-migrations.js" "$MIGRATIONS_DIR"',
    );
    expect(checkSource.indexOf("validate-supabase-migrations.js")).toBeLessThan(
      checkSource.indexOf("run_supabase start"),
    );
  });

  test("the disposable harness and release workflow use the same concrete CLI pin", () => {
    const checkSource = fs.readFileSync(
      path.resolve(__dirname, "../scripts/quest-database-check.sh"),
      "utf8",
    );
    const linkedCheckSource = fs.readFileSync(
      path.resolve(__dirname, "../scripts/verify-linked-supabase.sh"),
      "utf8",
    );
    const workflowSource = fs.readFileSync(
      path.resolve(__dirname, "../../../.github/workflows/quest-database.yml"),
      "utf8",
    );

    const harnessPin = checkSource.match(
      /SUPABASE_CLI_VERSION="\$\{SUPABASE_CLI_VERSION:-([^}]+)\}"/,
    )?.[1];

    expect(harnessPin).toMatch(/^\d+\.\d+\.\d+$/);
    expect(linkedCheckSource).toContain(
      `SUPABASE_CLI_VERSION="\${SUPABASE_CLI_VERSION:-${harnessPin}}"`,
    );
    expect(workflowSource).toContain(`version: ${harnessPin}`);
  });

  test("the disposable harness resolves the requested CLI before any global binary", () => {
    const checkSource = fs.readFileSync(
      path.resolve(__dirname, "../scripts/quest-database-check.sh"),
      "utf8",
    );

    const npxSelection = checkSource.indexOf(
      'SUPABASE_CMD=(npx --yes "supabase@${SUPABASE_CLI_VERSION}")',
    );
    const globalSelection = checkSource.indexOf("SUPABASE_CMD=(supabase)");

    expect(npxSelection).toBeGreaterThan(-1);
    expect(globalSelection).toBeGreaterThan(-1);
    expect(npxSelection).toBeLessThan(globalSelection);
  });

  test("the disposable check gates readiness on Auth instead of aggregate Docker health", () => {
    const checkSource = fs.readFileSync(
      path.resolve(__dirname, "../scripts/quest-database-check.sh"),
      "utf8",
    );

    expect(checkSource).toContain(
      'run_supabase start --ignore-health-check >/dev/null',
    );
    expect(checkSource).toContain(
      'run_supabase status --output json > "$START_OUTPUT_FILE"',
    );
    expect(checkSource).toContain(
      'curl --fail --silent --show-error "$API_URL/auth/v1/health"',
    );
  });

  test("the disposable check wires every connected Stage 2 suite to the same isolated project", () => {
    const checkSource = fs.readFileSync(
      path.resolve(__dirname, "../scripts/quest-database-check.sh"),
      "utf8",
    );

    for (const variable of [
      "TASK88_TEST_SUPABASE_URL",
      "TASK88_TEST_SUPABASE_ANON_KEY",
      "TASK88_TEST_SUPABASE_SERVICE_ROLE_KEY",
      "HUNT_DROP_TEST_SUPABASE_URL",
      "HUNT_DROP_TEST_SUPABASE_ANON_KEY",
      "HUNT_DROP_TEST_SUPABASE_SERVICE_ROLE_KEY",
    ]) {
      expect(checkSource).toContain(`export ${variable}=`);
    }

    for (const suite of [
      "__tests__/questRpc.integration.test.ts",
      "__tests__/socialRpc.integration.test.ts",
      "__tests__/huntAdvancedWorldMechanics.integration.test.ts",
      "__tests__/questVerification.integration.test.ts",
      "__tests__/questActivityTracking.integration.test.ts",
      "__tests__/huntDropAuthorization.integration.test.ts",
      "__tests__/membershipAllowancesCollectibles.integration.test.ts",
      "__tests__/moderationMediaRetention.integration.test.ts",
    ]) {
      expect(checkSource).toContain(`pnpm exec jest --runInBand ${suite}`);
    }
  });

  test("method verification remains server-owned and atomic", () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, "../supabase/migrations/070_quest_activity_tracking_security_repairs.sql"),
      "utf8",
    );
    const baseSource = fs.readFileSync(
      path.resolve(__dirname, "../supabase/migrations/065_quest_method_verification.sql"),
      "utf8",
    );
    const repairSource = fs.readFileSync(
      path.resolve(__dirname, "../supabase/migrations/066_quest_verification_audit_repairs.sql"),
      "utf8",
    );

    expect(baseSource).toContain("JOIN proof_media pm ON pm.submission_id = ps.id");
    expect(repairSource).toContain("quests_timer_requires_integrity");
    expect(repairSource).toContain("'integrity_confirmation' = ANY(verification_methods)");
    expect(repairSource).toContain("'pm.proof_id = ps.id'");
    expect(repairSource).toContain("'pm.submission_id = ps.id'");
  });

  test("activity sample retention is restricted to terminal participations and trusted workers", () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, "../supabase/migrations/069_quest_activity_sample_retention.sql"),
      "utf8",
    );

    expect(source).toContain("purge_expired_quest_activity_samples");
    expect(source).toContain("auth.role() <> 'service_role'");
    expect(source).toContain("participations.status IN ('completed', 'abandoned', 'expired')");
    expect(source).toContain("'quest_activity_samples_purged'");
    expect(source).not.toContain("DELETE FROM quest_participations");
  });

  test("activity security repairs authorize before duplicate reads and remove accuracy-based speed tolerance", () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, "../supabase/migrations/070_quest_activity_tracking_security_repairs.sql"),
      "utf8",
    );

    expect(source).toContain("RENAME TO record_quest_activity_sample_internal");
    expect(source).toContain("REVOKE ALL ON FUNCTION record_quest_activity_sample_internal");
    expect(source).toContain("SELECT user_id");
    expect(source).toContain("FOR UPDATE");
    expect(source).toContain("v_owner_id <> p_user_id");
    expect(source).toContain("'max_accuracy_meters', 25");
    expect(source).toContain("'accuracy_tolerance_multiplier', 0");
  });

  test("Hunt lock-state repair is safe during fresh migration ordering", () => {
    const mapSource = fs.readFileSync(
      path.resolve(__dirname, "../supabase/migrations/077_hunt_active_stop_map_locations.sql"),
      "utf8",
    );
    const repairSource = fs.readFileSync(
      path.resolve(__dirname, "../supabase/migrations/080_hunt_step_status_lock_state.sql"),
      "utf8",
    );
    const projectionRepairSource = fs.readFileSync(
      path.resolve(__dirname, "../supabase/migrations/081_hunt_map_projection_types.sql"),
      "utf8",
    );

    expect(mapSource).toContain(
      "hsp.status::TEXT NOT IN ('not_started', 'locked', 'expired')",
    );
    expect(mapSource).not.toContain("hsg.is_validation_zone");
    for (const state of [
      "available",
      "locked",
      "awaiting_proof",
      "under_review",
      "needs_resubmission",
      "rejected",
      "expired",
    ]) {
      expect(repairSource).toContain(
        `ADD VALUE IF NOT EXISTS '${state}';`,
      );
    }
    expect(projectionRepairSource).toContain(
      "hsg.public_radius_meters::DOUBLE PRECISION",
    );
  });
});

describe("NVIDIA Quest generation completion migration contract", () => {
  const completionMigration = fs.readFileSync(
    path.resolve(__dirname, "../supabase/migrations/082_ai_generation_completion.sql"),
    "utf8",
  );

  test("stores durable configuration, prompt history, attempts, and leased jobs", () => {
    expect(completionMigration).toContain("CREATE TABLE IF NOT EXISTS ai_generation_config");
    expect(completionMigration).toContain("CREATE TABLE IF NOT EXISTS ai_generation_config_versions");
    expect(completionMigration).toContain("CREATE TABLE IF NOT EXISTS ai_generation_prompt_versions");
    expect(completionMigration).toContain("CREATE TABLE IF NOT EXISTS ai_quest_generation_attempts");
    expect(completionMigration).toContain("CREATE TABLE IF NOT EXISTS ai_scheduler_jobs");
    expect(completionMigration).toContain("attempt_count INTEGER NOT NULL DEFAULT 0");
    expect(completionMigration).toContain("lease_expires_at");
  });

  test("keeps AI content server-only and prompt history immutable", () => {
    expect(completionMigration).toContain("ai_generation_prompt_history_guard");
    expect(completionMigration).toContain("NEW.prompt <> OLD.prompt");
    expect(completionMigration).toContain("REVOKE ALL ON ai_generation_config");
    expect(completionMigration).toContain("TO service_role");
    expect(completionMigration).not.toContain("GRANT SELECT ON ai_quest_generation_attempts");
  });

  test("promotes only approved content into an unpublished normal Quest draft", () => {
    expect(completionMigration).toContain("CREATE OR REPLACE FUNCTION promote_ai_quest_draft");
    expect(completionMigration).toContain("c.approval_status <> 'approved'");
    expect(completionMigration).toContain("(d->>'quest_type')::quest_type,'draft'");
    expect(completionMigration).toContain("published_quest_id=qid");
    expect(completionMigration).toContain("required_distance_meters");
    expect(completionMigration).toContain("activity_type");
    expect(completionMigration).not.toContain("(d->>'quest_type')::quest_type,'published'");
  });

  test("requires explicit staff Geo context and stores exact geometry outside public location data", () => {
    expect(completionMigration).toContain("Geo quests require explicit administrator geo context");
    expect(completionMigration).toContain("quest_locations");
    expect(completionMigration).toContain("quest_geofences");
    expect(completionMigration).toContain("ST_SetSRID(ST_MakePoint");
    expect(completionMigration).toContain("validation_lat");
    expect(completionMigration).toContain("validation_lng");
  });
});
