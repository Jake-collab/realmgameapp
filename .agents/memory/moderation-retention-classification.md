---
name: Moderation retention classification
description: Rejected-media cleanup state must distinguish retryable failures from blocked reference drift.
---

Persist cleanup failure classification separately from the operator-facing error text. Reference drift is `blocked_reference`; Storage request failures are `retryable`.

**Why:** Error wording is presentation and may change, while admin backlog counts and retry behavior need a stable contract.

**How to apply:** Have the trusted cleanup RPC write the classification, share the canonical values with the worker and admin projection, and keep `last_error` only for bounded diagnostic guidance.