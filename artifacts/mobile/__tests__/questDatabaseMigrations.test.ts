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

  test("activity tracking derives progress from protected, quality-checked samples", () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, "../supabase/migrations/070_quest_activity_tracking_security_repairs.sql"),
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
});
