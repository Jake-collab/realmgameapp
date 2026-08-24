---
name: Notification delivery boundary
description: Delivery, privacy, and device-lifecycle rules for Worlds notifications.
---

Create in-app notification history before attempting push delivery. Provider failures, quiet-hour suppression, disabled preferences, and invalid tokens must never remove or misrepresent that history.

**Why:** Push is best-effort and subject to provider/device policy. Treating a queued or failed provider response as a delivered player notification causes misleading operations and lost in-app updates.

**How to apply:** Route all events through the canonical copy/deep-link policy, retain idempotency through retries, and record provider delivery state separately. Retry only transient failures; permanently invalid tokens must disable the device. Register only already-permitted devices, and detach the owner-scoped device before logout clears the authenticated session. Never expose tokens, hidden game data, reporter identity, proof internals, or integrity signals in copy, metadata, or Admin diagnostics.