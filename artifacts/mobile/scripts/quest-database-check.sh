#!/usr/bin/env bash

# Run the live Quest and Social RPC/RLS contract suites against a disposable
# local Supabase database. A fresh volume receives the checked-in migrations
# before the suites run, and its volumes are deleted on exit.

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
MOBILE_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
MIGRATIONS_DIR="$MOBILE_DIR/supabase/migrations"
START_OUTPUT_FILE="${RUNNER_TEMP:-${TMPDIR:-/tmp}}/quest-supabase-start.json"
LOCAL_METADATA_DIR="$MOBILE_DIR/supabase/.temp"
LOCAL_METADATA_BACKUP="${START_OUTPUT_FILE}.metadata"
LOCAL_METADATA_MOVED=false
LOCAL_METADATA_FILES=(
  storage-version
  linked-project.json
  gotrue-version
  pooler-url
  postgres-version
  cli-latest
  project-ref
)
SUPABASE_STARTED=false
SUPABASE_CLI_VERSION="${SUPABASE_CLI_VERSION:-2.116.0}"

cleanup() {
  if [[ "$SUPABASE_STARTED" == true ]]; then
    (
      cd "$MOBILE_DIR"
      run_supabase stop --no-backup
    ) || echo "Warning: failed to remove disposable Supabase containers." >&2
  fi
  if [[ "$LOCAL_METADATA_MOVED" == true ]]; then
    for metadata_file in "${LOCAL_METADATA_FILES[@]}"; do
      if [[ -f "$LOCAL_METADATA_BACKUP/$metadata_file" ]]; then
        rm -f "$LOCAL_METADATA_DIR/$metadata_file"
        mv "$LOCAL_METADATA_BACKUP/$metadata_file" "$LOCAL_METADATA_DIR/$metadata_file"
      fi
    done
    rmdir "$LOCAL_METADATA_BACKUP" 2>/dev/null || true
  fi
  rm -f "$START_OUTPUT_FILE"
}
trap cleanup EXIT

if [[ ! -f "$MOBILE_DIR/supabase/config.toml" ]]; then
  echo "Missing artifacts/mobile/supabase/config.toml." >&2
  exit 1
fi

# Validate the checked-in history before invoking the Supabase CLI. This keeps
# malformed and colliding versions from reaching disposable database
# provisioning, and uses the same validator as the hosted-project check.
node "$SCRIPT_DIR/validate-supabase-migrations.js" "$MIGRATIONS_DIR"

# Prefer the package-manager-resolved CLI so an older global binary cannot
# silently override the checked-in pin. This matches the version checked by
# the release workflow and keeps local verification reproducible.
if command -v npx >/dev/null 2>&1; then
  SUPABASE_CMD=(npx --yes "supabase@${SUPABASE_CLI_VERSION}")
elif command -v supabase >/dev/null 2>&1; then
  SUPABASE_CMD=(supabase)
else
  echo "Quest database check requires the Supabase CLI." >&2
  exit 1
fi

run_supabase() {
  "${SUPABASE_CMD[@]}" "$@"
}

CLI_VERSION="$(run_supabase --version | tail -n 1 | sed -E 's/^supabase version //; s/^[[:space:]]+//; s/[[:space:]]+$//')"
if [[ -z "$CLI_VERSION" || "$CLI_VERSION" == "supabase version" ]]; then
  echo "Unable to determine the installed Supabase CLI version." >&2
  exit 1
fi
if [[ "$SUPABASE_CLI_VERSION" != "latest" && "$CLI_VERSION" != "$SUPABASE_CLI_VERSION" ]]; then
  echo "Quest database check requires Supabase CLI ${SUPABASE_CLI_VERSION}; found ${CLI_VERSION}." >&2
  echo "Install the pinned version or set SUPABASE_CLI_VERSION when deliberately testing an update." >&2
  exit 1
fi
if [[ "$SUPABASE_CLI_VERSION" == "latest" ]]; then
  echo "Testing candidate Supabase CLI ${CLI_VERSION} (resolved from latest)."
else
  echo "Testing Supabase CLI ${CLI_VERSION}."
fi

cd "$MOBILE_DIR"
# Generated Supabase metadata can point at the linked hosted project's service
# versions or internal migrations. Keep all of it out of this disposable
# provisioning run, then restore it in cleanup.
mkdir -p "$LOCAL_METADATA_BACKUP"
for metadata_file in "${LOCAL_METADATA_FILES[@]}"; do
  if [[ -f "$LOCAL_METADATA_DIR/$metadata_file" ]]; then
    mv "$LOCAL_METADATA_DIR/$metadata_file" "$LOCAL_METADATA_BACKUP/$metadata_file"
  fi
done
LOCAL_METADATA_MOVED=true
# Delete any volume from an interrupted prior run before provisioning the
# disposable project. `supabase start` then applies every migration to the
# fresh database as part of initialization.
run_supabase stop --no-backup >/dev/null 2>&1 || true
SUPABASE_STARTED=true
# The CLI can report a false-negative container health status while its Auth
# service is still completing first-run setup. Ask the successful start command
# for its local credentials directly, then verify the Auth endpoint ourselves
# below and fail closed if it never becomes available.
run_supabase start --ignore-health-check --output-format json --output json > "$START_OUTPUT_FILE"

read_local_value() {
  node -e '
    const fs = require("node:fs");
    const [file, key] = process.argv.slice(1);
    const value = JSON.parse(fs.readFileSync(file, "utf8"))[key];
    if (typeof value !== "string" || value.length === 0) process.exit(1);
    process.stdout.write(value);
  ' "$START_OUTPUT_FILE" "$1"
}

API_URL="$(read_local_value API_URL)"
ANON_KEY="$(read_local_value ANON_KEY)"
SERVICE_ROLE_KEY="$(read_local_value SERVICE_ROLE_KEY)"
DB_URL="$(read_local_value DB_URL)"

export QUEST_TEST_SUPABASE_URL="$API_URL"
export QUEST_TEST_SUPABASE_ANON_KEY="$ANON_KEY"
export QUEST_TEST_SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"
export SOCIAL_TEST_SUPABASE_URL="$API_URL"
export SOCIAL_TEST_SUPABASE_ANON_KEY="$ANON_KEY"
export SOCIAL_TEST_SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"
export SOCIAL_TEST_REQUIRE_INTEGRATION=true
export TASK88_TEST_SUPABASE_URL="$API_URL"
export TASK88_TEST_SUPABASE_ANON_KEY="$ANON_KEY"
export TASK88_TEST_SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"
export HUNT_DROP_TEST_SUPABASE_URL="$API_URL"
export HUNT_DROP_TEST_SUPABASE_ANON_KEY="$ANON_KEY"
export HUNT_DROP_TEST_SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"
export QUEST_TEST_DB_URL="$DB_URL"
export SUPABASE_URL="$API_URL"
export SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"

for attempt in {1..60}; do
  if curl --fail --silent --show-error "$API_URL/auth/v1/health" >/dev/null; then
    break
  fi
  if [[ "$attempt" == 60 ]]; then
    echo "Disposable Supabase Auth did not become healthy in time." >&2
    exit 1
  fi
  sleep 2
done

echo "Running Quest RPC and RLS contracts against the disposable database."
pnpm exec jest --runInBand __tests__/questRpc.integration.test.ts

echo "Running Social RPC contracts, including repeated opposite-direction races, against the disposable database."
pnpm exec jest --runInBand __tests__/socialRpc.integration.test.ts

echo "Running method-driven Quest verification contracts against the disposable database."
pnpm exec jest --runInBand __tests__/questVerification.integration.test.ts

echo "Running activity tracking validation, persistence, and idempotency contracts against the disposable database."
pnpm exec jest --runInBand __tests__/questActivityTracking.integration.test.ts

echo "Running direct Hunt Drop authorization contracts against the disposable database."
pnpm exec jest --runInBand __tests__/huntDropAuthorization.integration.test.ts

echo "Running membership, allowance, Drop Credit, collectible, refund, privacy, and seller ledger contracts against the disposable database."
pnpm exec jest --runInBand __tests__/membershipAllowancesCollectibles.integration.test.ts

echo "Running moderator cleanup operator actions against the disposable database."
pnpm exec jest --runInBand __tests__/moderationMediaRetention.integration.test.ts

echo "Running rejected-media Storage access and retention contracts against the disposable database."
pnpm --filter @workspace/api-server test