---
name: Quest verification boundary
description: Durable trust rules for composing camera, GPS, timer, and integrity verification.
---

Explicit verification methods may be composed when each method independently matches the Quest, while legacy rows without an explicit method list retain their prior proof behavior. Timer verification always includes a final integrity confirmation.

**Why:** Replacing legacy proof fields would break existing Quests, while blanket rejection of integrity composites would prevent legitimate higher-trust activities.

**How to apply:** Keep timer and integrity timestamps server-owned, submit GPS readings to the trusted validator before completion, require approved media and non-suspicious server validation inside the atomic completion RPC, and never award points from a separate client path.