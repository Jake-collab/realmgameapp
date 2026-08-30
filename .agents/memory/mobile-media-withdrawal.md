---
name: Mobile media withdrawal
description: Client behavior for approved media that is revoked after a signed URL has already reached a mobile screen
---

Approved media can be withdrawn by setting its media record's `deleted_at` while retaining moderation evidence. A signed URL already held by the mobile client must therefore be treated as disposable: image load failures render a neutral fallback, remove the stale URL from local display state, and invalidate the owning query so the next fetch observes the withdrawal.

**Why:** Storage revocation can happen after React state or a persisted React Query result has already resolved an approved URL.

**How to apply:** Any mobile consumer of signed media should handle image load failure without leaving broken imagery or implying that the withdrawn asset remains approved.