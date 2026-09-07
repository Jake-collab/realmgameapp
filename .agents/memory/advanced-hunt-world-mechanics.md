---
name: Advanced Hunt world mechanics
description: Optional participant-specific reveal, zones, dependencies, and coarse persistent exploration for Hunt gameplay.
---

Advanced Hunt mechanics are opt-in and must extend the existing Hunt lifecycle rather than create a second gameplay path. Participant reveal timestamps are the authorization boundary: direct mobile reads may include only revealed stop content, while map coordinates come from a separate participant-authorized public projection. Exact validation geometry remains server-only.

**Why:** Hidden objectives cannot be made safe by sending their coordinates and hiding markers in the client; reveal, completion, moderation, and progression must remain server-authoritative.

**How to apply:** Add new reveal modes, zone progression, timing, dependencies, or exploration through trusted RPCs and participant-scoped state. Keep simple Hunts on the default always-visible, non-persistent path, and use coarse cells/checkpoints instead of raw location trails for persistent exploration.