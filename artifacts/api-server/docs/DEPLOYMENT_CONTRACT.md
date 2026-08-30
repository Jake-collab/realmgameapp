# Production deployment contract

This document defines the repository-side contract for deploying Worlds. It does
not create provider projects, credentials, domains, or deployment records.

## Services

### API server

Build and run:

```bash
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/api-server run start
```

The API listens on `PORT`. The liveness endpoint is:

```text
GET /api/healthz
```

Liveness confirms that the process is running. It must not be used as proof that
Supabase, storage, AI, moderation, push, or scheduled jobs are available.

### Readiness

```text
GET /api/readiness
```

Readiness reports the configured state of each external capability. A production
release must not be called fully ready while the response reports `failed` or
required checks report `missing_config`.

### Scheduler/worker

Build once, then run a separate long-lived worker process:

```bash
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/api-server run worker
```

The worker requires:

```text
NODE_ENV=production
SCHEDULER_ENABLED=true
SCHEDULER_INTERVAL_SECONDS=60
SCHEDULER_MAINTENANCE_INTERVAL_SECONDS=3600
MODERATION_MEDIA_RETENTION_DAYS=30
SUPABASE_URL=<owner-supplied production URL>
SUPABASE_SERVICE_ROLE_KEY=<owner-supplied server secret>
```

The worker uses the Supabase-backed notification tables with atomic claims,
five-minute leases, bounded retries, and restart recovery. It owns the
database-native maintenance functions through one RPC entry point; do not also
register these functions in `pg_cron` or another scheduler. Multiple trusted
worker replicas may safely share the queue because claims use row locks and
leases.

If `SCHEDULER_ENABLED` is false, a development worker exits without claiming
work; a production worker exits nonzero so the service restart policy and alert
can surface the missing scheduler. If trusted Supabase configuration is absent,
production startup fails explicitly.
The API server and worker are separate processes. Publishing the API service
does not by itself publish or start the worker. In this repository's production
artifact, the exact combined-service start command is:

```bash
bash artifacts/api-server/scripts/start-production.sh
```

That launcher starts the API and the worker as sibling processes on one
always-on Reserved VM (or equivalent always-on service). It exits when either
child exits, so the deployment's automatic restart policy can recover a failed
API or worker. If the provider manages the processes separately, configure the
worker process with the `pnpm ... run worker` command above and the same
restart policy; do not replace it with a cron invocation or a short-lived job.

#### Worker monitoring and recovery

The worker emits structured logs for:

- `scheduled_worker_started` and `scheduled_worker_stopped`, which identify the
  worker instance and its configured cadence.
- `scheduled_worker_heartbeat`, emitted every scheduler interval even while a
  database cycle is in progress. Alert when two expected heartbeats are absent.
- `scheduled_worker_cycle_failed`, including
  `consecutiveCycleFailures`, `totalCycleFailures`, and the last successful
  cycle. Alert on three consecutive failures or any worker process exit.
- `scheduled_worker_cycle_complete`, including `queue.queueAgeSeconds`,
  `queue.oldestQueuedAt`, and per-queue timestamps. Alert when queue age
  exceeds the product's delivery SLA (five minutes is a reasonable initial
  threshold) and investigate the worker/Supabase connection.

The worker's in-app history and queue state remain in Supabase, so restarting
the process is safe: the next worker recovers expired leases and retries
bounded, idempotent work. An operator should first confirm the worker heartbeat
and server-only Supabase configuration, then restart the always-on service if
the process exited or heartbeats are stale. A restart is not a substitute for
investigating repeated cycle failures.

#### Scheduler alert verification record

The always-on launcher was smoke-tested against the non-production Supabase
project on 2026-08-30 with `NODE_ENV=production`, both API and worker
children, and a two-second interval to make the signals observable. The
documented production cadence remains 60 seconds.

Observed structured events and alert rules:

| Alert name / log event | Observed evidence | Operator threshold |
|---|---|---|
| `scheduled_worker_heartbeat` | Heartbeats were emitted while cycles were in progress and included `cycleCount`, `cycleStartedAt`, `consecutiveCycleFailures`, and `lastQueueHealth` | Alert after two expected heartbeats are absent (120 seconds at the 60-second production cadence) |
| `scheduled_worker_cycle_failed` | A temporary unreachable Supabase URL produced consecutive counts `1`, `2`, and `3` without stopping the worker; the third event carried `consecutiveCycleFailures: 3` | Alert at `consecutiveCycleFailures >= 3`, or on worker process exit |
| `scheduled_worker_cycle_complete` with `queue.queueAgeSeconds` | A controlled due scheduled row aged by more than ten minutes produced `queueAgeSeconds` values of 605–610 and identified `oldestByQueue.scheduledNotifications`; after RPC recovery, subsequent cycles reported `queueAgeSeconds: null` and all queue buckets null | Alert when `queue.queueAgeSeconds > 300` seconds (the initial five-minute delivery SLA) |

This verifies the production-format log events, fields, thresholds, and
recovery behavior. The repository does not select or provision an external
alert vendor; the owner must connect these event/field rules to the deployment
log alert provider and confirm delivery to the operator channel before launch.

## Admin and mobile

- Deploy the admin bundle separately from the API and point it at the approved API origin.
- Set `CORS_ORIGINS` to exact HTTPS origins only; never use wildcard CORS in production.
- Build the mobile app with `EXPO_PUBLIC_PRODUCTION_DOMAIN=matterrealm.com`.
- Configure `https://matterrealm.com/auth/callback` in the Supabase Auth redirect allowlist.
- Serve the iOS and Android association files from `matterrealm.com`.

## Release gate

Run:

```bash
pnpm readiness
```

Then verify `/api/healthz`, `/api/readiness`, the worker logs, Supabase Auth,
storage/RLS, native deep links, Mapbox on physical devices, and push delivery
using owner-supplied credentials. No local check can replace those live tests.