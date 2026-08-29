# Worlds scheduled jobs

## One execution model

Worlds uses one trusted scheduler: the long-lived API worker started with
`pnpm --filter @workspace/api-server run worker`. It runs every
`SCHEDULER_INTERVAL_SECONDS` (60 seconds by default) and uses Supabase
service-role RPCs for all durable state changes. Database `pg_cron` is not
registered for these jobs, so notification work and maintenance cannot run
twice through competing schedulers.

The worker is safe to scale beyond one replica because claims use
`FOR UPDATE SKIP LOCKED` and expiring leases. A process crash leaves durable
rows recoverable on the next cycle. Push delivery remains at-least-once around
an ambiguous provider response; the database delivery row is idempotent even
when a provider request must be retried.

## Inventory

| Job | Purpose | Implementation | Cadence | Scheduler | Retry/idempotency | Production status |
|---|---|---|---|---|---|---|
| Notification event processing | Render durable immediate events into in-app history and push deliveries | `SupabaseNotificationStore.runDue()` and migration 055 RPCs | Every 60s | API worker | Unique event idempotency key, atomic claim, 5 attempts, 5-minute lease | Implemented; requires one trusted worker |
| Scheduled notification processing | Materialize due delayed notifications | `SupabaseNotificationStore.runDue()` and migration 055 RPCs | Every 60s | API worker | Unique scheduled idempotency key, atomic claim, 5 attempts, 5-minute lease | Implemented; requires one trusted worker |
| Push delivery retry | Send queued device deliveries | `SupabaseNotificationStore.flushQueued()` and migration 055 RPCs | Every 60s | API worker | Atomic delivery claim, 3 attempts, 5-minute lease, exponential backoff; invalid tokens disabled | Implemented; requires Expo server credentials for actual push |
| Hunt invitation expiry | Mark overdue pending invitations expired | `expire_hunt_invitations()` | Hourly maintenance pass | API worker | Idempotent status predicate | Implemented |
| Quest participation expiry | Mark eligible overdue participations expired | `expire_quest_participations()` | Hourly maintenance pass | API worker | Idempotent status and deadline predicate | Implemented |
| Validation coordinate retention | Remove exact coordinates after 90 days while retaining result metadata | `purge_expired_validation_coordinates()` | Hourly maintenance pass | API worker | Idempotent null/purged predicate | Implemented |
| Ephemeral session cleanup | Remove expired, unconsumed verification, collection, placement, and creator-sweep sessions | `purge_expired_ephemeral_sessions()` | Hourly maintenance pass | API worker | Deletes only unconsumed expired rows; existing `RESTRICT` FKs protect evidence | Implemented |

Maintenance is called through `run_scheduled_maintenance()`, which invokes
only the functions listed above. `SCHEDULER_MAINTENANCE_INTERVAL_SECONDS`
defaults to 3600 seconds.

## Explicitly not active in Build 1

These categories were audited and are not silently claimed as production jobs:

- Moderation retry/recovery: moderation decisions are synchronous/manual and
  there is no durable moderation work queue.
- Rejected-media Storage deletion: the database exposes bounded candidates
  through `list_moderation_retention_candidates()`, but no worker currently
  deletes Storage objects. No deletion job is registered.
- Hunt lifecycle transitions, stale Hunt sessions, and leaderboard
  recalculation: no current scheduled implementation or documented Build 1
  worker contract exists.

## Security and observability

Migration 055 grants worker RPCs only to `service_role`; ordinary mobile
credentials are not granted execute access. The worker reads
`SUPABASE_SERVICE_ROLE_KEY` only from the server environment. The mobile
artifact uses the public Supabase URL/anonymous key contract and contains no
service-role credential path.

Each cycle logs processed work, recovery counts, delivery outcomes,
maintenance results, overlap skips, and failures. The worker refuses to start
in production without trusted Supabase configuration. In-app notification
history is materialized before push delivery, and provider failure never
removes that history.