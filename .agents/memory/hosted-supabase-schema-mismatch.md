---
name: Hosted Supabase schema mismatch
description: The currently linked hosted Supabase project has a stale migration journal and an incompatible legacy schema.
---

Do not run `supabase db push` against the currently linked Supabase project until the owner either connects a genuinely clean project or explicitly approves a destructive reset after a backup.

**Why:** The remote migration history records the early Worlds migrations as applied, but the actual database contains a different legacy game schema with incompatible enum definitions and excluded features. Applying later migrations fails because tables expected from the recorded history do not exist.

**How to apply:** Treat migration history as untrusted for this project. First preserve or discard the legacy schema through an owner-approved remediation path, then link the resulting clean database and apply the full canonical migration sequence.