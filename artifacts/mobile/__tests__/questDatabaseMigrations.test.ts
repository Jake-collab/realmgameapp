// @ts-nocheck
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
      path.resolve(__dirname, "../supabase/migrations/065_quest_method_verification.sql"),
      "utf8",
    );

    expect(source).toContain("IF auth.uid() <> p_user_id THEN");
    expect(source).toContain("verification_earliest_completion_at > NOW()");
    expect(source).toContain("Approved camera proof is required.");
    expect(source).toContain("Validated GPS proof is required.");
    expect(source).toContain("Integrity confirmation is required.");
    expect(source).toContain("ON CONFLICT (idempotency_key) DO NOTHING");
    expect(source).toContain("REVOKE UPDATE ON quest_participations FROM anon, authenticated");
    expect(source).toContain("GRANT EXECUTE ON FUNCTION complete_quest(UUID, UUID, TEXT) TO authenticated");
  });

  test("audit repairs enforce timed integrity and the canonical proof-media join", () => {
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
});