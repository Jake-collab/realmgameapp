#!/usr/bin/env bash

# Verify that the linked Supabase project has the complete canonical Worlds
# migration history and the core Quest/Hunt authorization surface. Secrets are
# read only from the execution environment; this script never writes them.

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
MOBILE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
MIGRATIONS_DIR="$MOBILE_DIR/supabase/migrations"
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
node - "$MIGRATION_JSON" "$MIGRATIONS_DIR" "$SCRIPT_DIR/validate-supabase-migrations.js" <<'NODE'
const fs = require('node:fs');
const migrationsDir = process.argv[3];
const {
  formatMigrationValidationError,
  getCanonicalMigrations,
} = require(process.argv[4]);

try {
  const { migrations } = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));

  if (!Array.isArray(migrations)) {
    throw new Error('Supabase CLI returned an invalid migration list.');
  }

  const canonical = getCanonicalMigrations(migrationsDir);

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
} catch (error) {
  console.error(formatMigrationValidationError(error));
  process.exitCode = 1;
}
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
  '"moderate_media_retention_cleanup"'
  '"operator_resolution"'
  '"resolved_by"'
  '"send_friend_request"'
  'GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."media_retention_cleanups" TO "service_role"'
  'CREATE OR REPLACE FUNCTION "public"."purge_expired_quest_activity_samples"'
  'quest_activity_samples_purged'
  'Unauthorized activity sample.'
  'record_quest_activity_sample_internal'
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