# Worlds owner setup checklist

This checklist records actions that cannot be completed from the repository. Do not replace placeholders with guessed projects or credentials.

## Supabase

- [ ] Create separate development, preview, and production projects.
- [ ] Add the mobile URL and anon key only to the mobile build environment.
- [ ] Add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` only to the API server/CI environment.
- [ ] Run `supabase db push` from the linked project after reviewing every migration; do not run seed data in production.
- [ ] Create all private storage buckets and apply the policies in `artifacts/mobile/docs/STORAGE_ARCHITECTURE.md`.
- [ ] Configure Auth email, redirect allowlists, rate limits, and the owner-assigned HTTPS domain.
- [ ] Publish/configure the API production service with `bash artifacts/api-server/scripts/start-production.sh` on an always-on Reserved VM (or equivalent). This starts the API and trusted worker together; if the provider separates them, run the worker with `pnpm --filter @workspace/api-server run worker` after the one-time build.
- [ ] Give the worker the same production `SUPABASE_URL` and server-only `SUPABASE_SERVICE_ROLE_KEY` as the API through the provider's secret environment, never through mobile or browser configuration.
- [ ] Set `SCHEDULER_ENABLED=true`, `SCHEDULER_INTERVAL_SECONDS=60`, and `SCHEDULER_MAINTENANCE_INTERVAL_SECONDS=3600`; do not also register these jobs in Supabase `pg_cron`.
- [ ] Configure automatic service restart when either sibling process exits, and route the verified scheduler rules to the deployment alert provider: missing `scheduled_worker_heartbeat` for two cadences (120 seconds at the 60-second production interval), `scheduled_worker_cycle_failed` when `consecutiveCycleFailures >= 3`, and `scheduled_worker_cycle_complete.queue.queueAgeSeconds > 300`.
- [x] Run the non-production always-on launcher smoke test and verify the three consecutive-failure signal, aged-queue signal, and clear-after-recovery behavior recorded in `docs/DEPLOYMENT_CONTRACT.md`.
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

## RevenueCat and store release

- [x] Create the Worlds RevenueCat project, Test Store catalog, membership entitlement, and current offering.
- [ ] Store `REVENUECAT_WEBHOOK_AUTHORIZATION` as a server-only Replit Secret and configure the same Authorization header on `https://worlds-game-app.replit.app/api/webhooks/revenuecat`.
- [ ] Publish migrations 074–075 and the updated API before enabling the RevenueCat webhook.
- [ ] After the first TestFlight and Play internal-test builds, sync the monthly/yearly membership, Drop Credit, and supported Collectible price-tier products into App Store Connect and Google Play.
- [ ] Exercise monthly/yearly purchase, all three credit packs, paid Collectible, restore, refund, expiration, billing issue, account switch, and webhook retry on signed physical-device builds.
- [ ] Enroll in Apple’s Small Business Program if eligible before launch: https://developer.apple.com/app-store/small-business-program/enroll/