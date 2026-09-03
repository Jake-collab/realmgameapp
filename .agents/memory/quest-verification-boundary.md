---
name: Quest verification boundary
description: Durable trust rules for composing camera, GPS, timer, and integrity verification.
---

Explicit verification methods may be composed when each method independently matches the Quest, while legacy rows without an explicit method list retain their prior proof behavior. Timer verification always includes a final integrity confirmation.

**Why:** Replacing legacy proof fields would break existing Quests, while blanket rejection of integrity composites would prevent legitimate higher-trust activities.

**How to apply:** Keep timer and integrity timestamps server-owned, submit GPS readings to the trusted validator before completion, require approved media and non-suspicious server validation inside the atomic completion RPC, and never award points from a separate client path.

One-time proof-session issuance is an authenticated RPC but must run as a narrowly scoped `SECURITY DEFINER` function with a fixed `search_path` when the session table intentionally has no client INSERT policy. Keep the explicit identity and participation-eligibility checks in that function.

**Why:** The proof trigger requires a session, while the session table is RLS-protected against direct client inserts; an invoker function therefore makes camera and location proof impossible.

**How to apply:** Treat session issuance as a trusted server boundary, keep execution restricted to `authenticated`, and do not add a broad client INSERT policy just to make the flow work.