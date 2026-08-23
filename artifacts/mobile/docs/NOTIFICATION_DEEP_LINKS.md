# Notification Deep Links

Notification destinations use the `worlds://` scheme and are parsed through a strict allowlist for Quest, Hunt, custom Hunt, submission, progress, profile, and notification destinations.

Push taps resolve authentication first, then validate the target ID and normal authorization rules before navigation. A deep link never grants access. Logged-out destinations must be preserved only as safe route intent and revalidated after sign-in. Invalid, deleted, or inaccessible targets fall back to the Notification Center.