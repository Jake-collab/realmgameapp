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

raw_migrations="$(run_supabase migration list --linked --output-format json)"
migration_json="$(printf '%s\n' "$raw_migrations" | sed -n '/^{"migrations":/,$p')"
if [[ -z "$migration_json" ]]; then
  echo "Supabase CLI did not return migration JSON." >&2
  exit 1
fi

printf '%s\n' "$migration_json" > "$MIGRATION_JSON"
node - "$MIGRATION_JSON" <<'NODE'
const fs = require('node:fs');
const { migrations } = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const expected = Array.from({ length: 59 }, (_, index) => String(index + 1).padStart(3, '0'));

if (migrations.length !== expected.length) {
  throw new Error(`Expected ${expected.length} migrations; received ${migrations.length}.`);
}

for (const version of expected) {
  const entry = migrations.find(({ local }) => local === version);
  if (!entry || entry.remote !== version) {
    throw new Error(`Migration ${version} is not applied cleanly.`);
  }
}

console.log('Migration parity passed for canonical migrations 001–059.');
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