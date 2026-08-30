const fs = require("node:fs");
const path = require("node:path");

function getCanonicalMigrations(migrationsDir) {
  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort((left, right) => {
      const leftVersion = Number(
        left.match(/^(\d+)_/)?.[1] ?? Number.MAX_SAFE_INTEGER,
      );
      const rightVersion = Number(
        right.match(/^(\d+)_/)?.[1] ?? Number.MAX_SAFE_INTEGER,
      );
      return leftVersion - rightVersion || left.localeCompare(right);
    });

  if (migrationFiles.length === 0) {
    throw new Error(`No SQL migrations found in ${migrationsDir}.`);
  }

  const canonical = migrationFiles.map((file) => {
    const match = /^(\d{3})_.+\.sql$/.exec(file);
    if (!match) {
      throw new Error(
        `Migration filename must start with a three-digit version and follow ` +
          `NNN_description.sql (for example, 001_create_users.sql): ${path.join(
            migrationsDir,
            file,
          )}`,
      );
    }
    return { file, version: match[1] };
  });

  const seenVersions = new Map();
  for (const { file, version } of canonical) {
    const previous = seenVersions.get(version);
    if (previous) {
      throw new Error(
        `Duplicate canonical migration version ${version}: ${previous} and ${file}. ` +
          "Rename one file so each migration version is unique.",
      );
    }
    seenVersions.set(version, file);
  }

  return canonical;
}

if (require.main === module) {
  try {
    const migrationsDir = process.argv[2];
    if (!migrationsDir) {
      throw new Error(
        "Usage: node validate-supabase-migrations.js <migrations-dir>",
      );
    }

    const canonical = getCanonicalMigrations(migrationsDir);
    const first = canonical[0].version;
    const last = canonical[canonical.length - 1].version;
    console.log(
      `Migration filename preflight passed for ${canonical.length} canonical migrations (${first}–${last}).`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Migration filename preflight failed: ${message}`);
    process.exitCode = 1;
  }
}

module.exports = { getCanonicalMigrations };
