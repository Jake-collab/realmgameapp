---
name: Creator safety boundary
description: Durable safety rules for custom Hunt drafts and moderation submission.
---

Custom Hunt creation must remain server-authoritative: private answers and exact validation geometry can exist in owner-scoped drafts, but never in player previews or public Hunt data. Submission must require explicit safety and no-trespassing/public-access acknowledgments, and intended invitees are only references until moderation approval.

**Why:** A creator preview or early invitation must not leak validation secrets or imply that an unreviewed Hunt is playable.

**How to apply:** Keep creator payloads isolated from player-facing Hunt types, enforce the same gates in client validation and creator RPCs, and recheck invitation eligibility at publication time.