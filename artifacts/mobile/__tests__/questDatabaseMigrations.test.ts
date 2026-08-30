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
});