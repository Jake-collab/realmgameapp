# Worlds owner setup checklist

This checklist records actions that cannot be completed from the repository. Do not replace placeholders with guessed projects or credentials.

## Supabase

- [ ] Create separate development, preview, and production projects.
- [ ] Add the mobile URL and anon key only to the mobile build environment.
- [ ] Add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` only to the API server/CI environment.
- [ ] Run `supabase db push` from the linked project after reviewing every migration; do not run seed data in production.
- [ ] Create all private storage buckets and apply the policies in `artifacts/mobile/docs/STORAGE_ARCHITECTURE.md`.
- [ ] Configure Auth email, redirect allowlists, rate limits, and the owner-assigned HTTPS domain.
- [ ] Publish/configure a separate always-on trusted worker process using `pnpm --filter @workspace/api-server run worker`; it must use the same production Supabase URL and server-only service-role secret as the API.
- [ ] Set `SCHEDULER_ENABLED=true`, `SCHEDULER_INTERVAL_SECONDS=60`, and `SCHEDULER_MAINTENANCE_INTERVAL_SECONDS=3600`; do not also register these jobs in Supabase `pg_cron`.
- [ ] Enable backups and test a restore before launch.

## Mapbox and native builds

- [ ] Create a restricted public token for `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN`.
- [ ] Confirm the token’s allowed URLs/apps and usage limits.
- [ ] Add the final domain to iOS Associated Domains and Android App Links after the domain exists.
- [ ] Produce development/preview/production native builds and test foreground location, maps, permissions, and attribution on physical iOS and Android devices.

## AI and moderation

- [ ] Store AI and moderation credentials only as API-server secrets.
- [ ] Keep AI generation draft-only and require human Quest review.
- [ ] Choose `manual_only`, `low_risk`, or `mixed` moderation policy deliberately; automated moderation may not perform irreversible enforcement alone.
- [ ] Confirm provider retention/privacy terms for any media or text sent for review.

## Push and deployment

- [ ] Configure the Expo project identity, iOS push credentials, Android FCM credentials, and `EXPO_ACCESS_TOKEN`.
- [ ] Test token registration, permission denial, invalid-token handling, receipts, and deep-link navigation on physical devices.
- [ ] Set exact `CORS_ORIGINS` for deployed admin origins; do not use wildcard CORS in production.
- [ ] Follow `docs/DEPLOYMENT_CONTRACT.md` for separate API, admin, and worker processes.
- [ ] Deploy API and admin with separate environment values, then verify `/api/healthz` and `/api/readiness`.