# Notification Scheduling

Scheduled reminders use the user's IANA timezone, not a fixed UTC offset. Quiet hours correctly support ranges that cross midnight, such as 22:00–07:00.

Immediately before delivery, workers revalidate the relevant Quest/Hunt state, participation, preferences, and cancellation/completion status. Stale reminders are suppressed. Non-critical engagement notifications use capped retries, duplicate cooldowns, batching, and per-user limits; security/account notifications are handled separately.

Live scheduling requires the Supabase migration and a trusted worker or scheduler. The disconnected app does not pretend scheduled jobs ran.