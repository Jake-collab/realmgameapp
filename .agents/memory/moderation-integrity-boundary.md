---
name: Moderation and integrity boundary
description: Prompt 20 safety automation is provider-neutral, server-only, conservative, and separate from proof validity.
---

Moderation results and integrity risk are normalized on the API server before policy decisions. Public content may be auto-approved only through an explicit low-risk policy; private proof safety never decides proof correctness; VPN, GPS noise, duplicate media, and mock-location signals create review context rather than automatic permanent sanctions.

**Why:** The existing Worlds schema already separates media moderation from proof status and uses trusted server transactions for rewards. Combining these concerns or trusting a single provider signal would let ambiguous safety or integrity evidence alter gameplay irreversibly.

**How to apply:** Keep provider secrets and internal scores server-only, preserve pending/manual fallback when automation is unavailable, hash content for idempotency without exposing hashes, snapshot policy versions, and route high-impact actions to authorized human review.