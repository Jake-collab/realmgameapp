#!/usr/bin/env bash

# Verify that the linked Supabase project has the complete canonical Worlds
# migration history and the core Quest/Hunt authorization surface. Secrets are
# read only from the execution environment; this script never writes them.

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
MOBILE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SUPABASE_CLI_VERSION="${SUPABASE_CLI_VERSION:-2.115.0}"
SCHEMA_DUMP="$(mktemp "${TMPDIR:-/tmp}/worlds-linked-schema.XXXXXX.sql")"
MIGRATION_JSON="$(mktemp "${TMPDIR:-/tmp}/worlds-linked-migrations.XXXXXX.json")"

cleanup() {
  rm -f "$SCHEMA_DUMP" "$MIGRATION_JSON"
}
trap cleanup EXIT

if command -v npx >/dev/null 2>&1; then
  SUPABASE_CMD=(npx --yes "supabase@${SUPABASE_CLI_VERSION}")
elif command -v supabase >/dev/null 2>&1; then
  SUPABASE_CMD=(supabase)
else
  echo "Linked Supabase verification requires the Supabase CLI or npx." >&2
  exit 1
fi

run_supabase() {
  "${SUPABASE_CMD[@]}" "$@"
}

cd "$MOBILE_DIR"

if [[ ! -f "supabase/.temp/project-ref" ]]; then
  echo "No linked Supabase project was found. Run supabase link first." >&2
  exit 1
fi

: "${SUPABASE_DB_PASSWORD:?Set SUPABASE_DB_PASSWORD for the linked project before verification.}"

project_ref="$(<supabase/.temp/project-ref)"
echo "Verifying linked Supabase project ${project_ref}."

raw_migrations="$(run_supabase --output-format json migration list --linked)"
migration_json="$(printf '%s\n' "$raw_migrations" | sed -n '/^{"migrations":/,$p')"
if [[ -z "$migration_json" ]]; then
  echo "Supabase CLI did not return migration JSON." >&2
  exit 1
fi

printf '%s\n' "$migration_json" > "$MIGRATION_JSON"
node - "$MIGRATION_JSON" "$MOBILE_DIR/supabase/migrations" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const { migrations } = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const migrationsDir = process.argv[3];

if (!Array.isArray(migrations)) {
  throw new Error('Supabase CLI returned an invalid migration list.');
}

const migrationFiles = fs.readdirSync(migrationsDir)
  .filter((file) => file.endsWith('.sql'))
  .sort((left, right) => {
    const leftVersion = Number(left.match(/^(\d+)_/)?.[1] ?? Number.MAX_SAFE_INTEGER);
    const rightVersion = Number(right.match(/^(\d+)_/)?.[1] ?? Number.MAX_SAFE_INTEGER);
    return leftVersion - rightVersion || left.localeCompare(right);
  });

if (migrationFiles.length === 0) {
  throw new Error(`No SQL migrations found in ${migrationsDir}.`);
}

const canonical = migrationFiles.map((file) => {
  const match = /^(\d{3})_.+\.sql$/.exec(file);
  if (!match) {
    throw new Error(`Migration filename must start with a three-digit version: ${path.join(migrationsDir, file)}`);
  }
  return { file, version: match[1] };
});

const seenVersions = new Map();
for (const { file, version } of canonical) {
  const previous = seenVersions.get(version);
  if (previous) {
    throw new Error(`Duplicate canonical migration version ${version}: ${previous} and ${file}.`);
  }
  seenVersions.set(version, file);
}

if (migrations.length !== canonical.length) {
  throw new Error(`Expected ${canonical.length} canonical migrations; received ${migrations.length} linked migrations.`);
}

for (let index = 0; index < canonical.length; index += 1) {
  const expected = canonical[index].version;
  const entry = migrations[index];
  if (!entry || entry.local !== expected || entry.remote !== expected) {
    const actual = entry
      ? `local ${entry.local ?? '<none>'}, remote ${entry.remote ?? '<none>'}`
      : 'no linked migration';
    throw new Error(`Migration parity mismatch at position ${index + 1}: expected ${expected}, received ${actual}.`);
  }
}

const first = canonical[0].version;
const last = canonical[canonical.length - 1].version;
console.log(`Migration parity passed for ${canonical.length} canonical migrations (${first}–${last}).`);
NODE

run_supabase db dump --linked --schema public --file "$SCHEMA_DUMP" >/dev/null

required_markers=(
  'ALTER TABLE "public"."quests" ENABLE ROW LEVEL SECURITY'
  'ALTER TABLE "public"."hunts" ENABLE ROW LEVEL SECURITY'
  '"complete_quest"'
  '"issue_hunt_drop_collection_session"'
  '"collect_hunt_drop"'
  '"run_scheduled_maintenance"'
  '"claim_notification_events"'
)

for marker in "${required_markers[@]}"; do
  if ! grep -Fq "$marker" "$SCHEMA_DUMP"; then
    echo "Missing required schema marker: $marker" >&2
    exit 1
  fi
done

rls_tables="$(grep -Eic 'ENABLE ROW LEVEL SECURITY' "$SCHEMA_DUMP")"
quest_policies="$(grep -Eic '^CREATE POLICY .* ON "public"\."quests"' "$SCHEMA_DUMP")"
hunt_policies="$(grep -Eic '^CREATE POLICY .* ON "public"\."hunts"' "$SCHEMA_DUMP")"
if [[ "$rls_tables" -lt 1 || "$quest_policies" -lt 1 || "$hunt_policies" -lt 1 ]]; then
  echo "Expected RLS tables plus Quest and Hunt policies in the linked schema dump." >&2
  exit 1
fi

echo "Core Quest/Hunt schema and RLS checks passed (${rls_tables} RLS tables, ${quest_policies} Quest policies, ${hunt_policies} Hunt policies)."