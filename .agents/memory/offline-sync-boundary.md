---
name: Offline sync boundary
description: Safety rules for the mobile offline cache and durable mutation queue.
---

Offline persistence may retain user-scoped safe cache, editable drafts, proof media references, and approved low-risk intents. It must not represent a protected server decision as completed locally.

**Why:** Location validation, points, progress transitions, Drop collection, clue unlocks, invitations, publication, moderation, and rewards depend on fresh authorization and server-side policy.

**How to apply:** Keep the allow-list narrow, serialize writes per account, use idempotency keys and dependency ordering, and revalidate the active session before every replayed protected intent. Show waiting, retrying, or attention-needed state instead of fabricated success; ignore data with a mismatched account scope.