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
SUPABASE_URL=<owner-supplied production URL>
SUPABASE_SERVICE_ROLE_KEY=<owner-supplied server secret>
```

The worker uses the idempotent due-notification loop and must run as one trusted
replica unless a shared Supabase-backed claim/lock adapter is enabled. The
current local notification store is intentionally not a production persistence
adapter; it is safe for local diagnostics only. Before launch, the worker's
storage operations must be wired to the production Supabase notification tables
and verified against the live schema.

If `SCHEDULER_ENABLED` is false, the worker exits without claiming work. If
trusted Supabase configuration is absent, production startup fails explicitly.

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