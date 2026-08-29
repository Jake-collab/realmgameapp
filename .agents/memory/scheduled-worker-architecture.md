---
name: Scheduled worker architecture
description: Worlds uses one trusted API worker for durable notifications and database maintenance.
---

The API worker is the single scheduler for notification events, scheduled notifications, push retries, and the implemented database maintenance functions. Supabase `pg_cron` must not be registered for the same jobs.

**Why:** Competing schedulers could duplicate notification work and maintenance. Supabase-backed claims, leases, idempotency keys, and bounded retries make restart recovery safe while keeping in-app history authoritative over push outcomes.

**How to apply:** Keep worker RPCs `service_role`-only, preserve the 5-minute recovery lease and bounded retry rules, and treat worker deployment/liveness as a separate production concern from the API service.