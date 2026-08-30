---
name: Quest activity verification
description: Durable security and privacy rules for distance-based Quest verification.
---

Distance progress must be derived server-side from sequential samples tied to an owned, active participation. Authorization must happen before duplicate lookups or any response that includes derived progress.

**Why:** A pre-authorization idempotency lookup can disclose another player's progress, and caller-reported GPS accuracy must never expand a speed ceiling enough to make fabricated distance plausible.

**How to apply:** Keep speed limits independent of reported accuracy, reject low-quality/stale/out-of-order samples, keep completion and points in the atomic Quest RPC, expose no raw route reads to players, and purge terminal raw samples while preserving derived distance.