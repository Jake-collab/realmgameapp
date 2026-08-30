---
name: Cleanup history snapshots
description: Admin cleanup pagination must remain stable while worker updates continue.
---

Cleanup history snapshots must define membership and ordering from immutable creation data, while refresh explicitly starts a new boundary; mutable worker timestamps cannot determine page membership.

**Why:** Worker claims, retries, and completions update operational timestamps during long moderator investigations, which can otherwise skip or duplicate records across offset pages.

**How to apply:** Return the server-issued boundary with the first page, reuse it for subsequent pages, use a deterministic creation-time plus ID ordering, and discard it only on explicit refresh.