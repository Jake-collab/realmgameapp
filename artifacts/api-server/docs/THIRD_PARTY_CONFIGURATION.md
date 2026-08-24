# Third-party configuration contract

## Status meanings

The API readiness endpoint reports `ready`, `degraded`, `disabled`, `missing_config`, or `failed`. Configuration checks never prove network reachability. A provider must be tested separately with owner credentials before being marked live.

| Service | Server-only values | Client-safe values | Without setup |
|---|---|---|---|
| Supabase/Auth | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Consumer app stays in truthful disconnected state; staff data is unavailable |
| Mapbox | None in API | `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN`, optional style URLs | Map unavailable; no fake markers or coordinates |
| AI Quest generation | `AI_API_URL`, `AI_API_KEY`, `AI_MODEL` | None | Generation disabled; no fake candidates |
| Moderation | `MODERATION_*` | None | Manual review mode; no automatic approval |
| Push | `EXPO_ACCESS_TOKEN` | Native app identity and permission config | In-app notifications remain authoritative; push is unavailable |

AI and automated moderation are optional for consumer startup. Missing required Supabase server configuration is a failed production readiness state. Notification delivery never grants gameplay authority.

## Release commands

```bash
pnpm install --frozen-lockfile
pnpm readiness
pnpm --filter @workspace/mobile run build
```

The readiness command is non-destructive. It performs local typecheck/build checks and reports missing external setup; it does not link projects, mutate production, send push messages, or run migrations.