#!/usr/bin/env bash
set -Eeuo pipefail

# One Reserved VM owns both long-lived processes. The API remains the
# externally reachable process; the worker is the existing trusted scheduler.
node --enable-source-maps artifacts/api-server/dist/index.mjs &
api_pid=$!

node --enable-source-maps artifacts/api-server/dist/worker.mjs &
worker_pid=$!

shutdown() {
  kill "$api_pid" "$worker_pid" 2>/dev/null || true
  wait "$api_pid" "$worker_pid" 2>/dev/null || true
}
trap shutdown TERM INT

while kill -0 "$api_pid" 2>/dev/null && kill -0 "$worker_pid" 2>/dev/null; do
  sleep 2
done

status=0
if ! kill -0 "$api_pid" 2>/dev/null; then
  wait "$api_pid" || status=$?
else
  wait "$worker_pid" || status=$?
fi

shutdown
exit "$status"