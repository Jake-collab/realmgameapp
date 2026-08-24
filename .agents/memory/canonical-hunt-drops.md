---
name: Canonical Hunt Drops
description: Durable privacy, collection, reward, and placement constraints for the Hunt Drop model.
---

Hunt Drops extend the existing Hunt-stop engine; do not introduce a parallel drop engine. Keep four geometry layers distinct: a broad public search zone, an optional clue-reveal rule, private collection geometry, and a server-enforced collection radius.

**Why:** Exact targets make location-based play unsafe and easily exploitable; allowing client completion or a public geofence leaks the target and defeats idempotent reward handling.

**How to apply:** Give clients only approved approximate zones. Require an authenticated, short-lived online collection session plus a second server-side location check before recording a collection or issuing Hunt-only ledger points. Offline work can preserve drafts and previously authorized public information, never unlock/collect/award.

Placement providers supply evidence only. PASS requires complete public-access and safety evidence; unavailable, ambiguous, remote, or mismatched evidence becomes REVIEW; private homes, roadways, restricted or hazardous spaces become REJECT.

**Why:** Map and vision providers can be unavailable or uncertain, and media moderation answers a different question from physical access safety.

**How to apply:** Keep placement evidence protected, version decisions and locations, do not silently move active participants, and give Admin review separate relocation and safety-report paths.