# Worlds Notification Architecture

Notifications are derived from trusted Quest, Hunt, social, progression, moderation, and account events. The pipeline is:

`domain event → policy/copy → in-app record → delivery queue → push provider → delivery status`

Gameplay and moderation transactions remain authoritative. Push acceptance never means gameplay succeeded. Idempotency keys prevent repeated events from creating duplicate records, while delivery attempts remain separate so a push failure never removes in-app history.

The mobile client may read its own notifications, update its own read state and preferences, and register its own installation. Recipient selection, notification creation, fan-out, scheduling, and provider access belong to trusted server infrastructure.

Before Supabase is connected, the app fails closed for persistence and push delivery. No local fallback claims that a notification was delivered.