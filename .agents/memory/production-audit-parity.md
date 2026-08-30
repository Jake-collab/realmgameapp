---
name: Production audit parity
description: Release-audit practice for detecting repository migrations that have not reached the linked Supabase project.
---

Repository-only migration validation can pass while production is still missing a canonical migration. A complete release audit must compare linked migration history and directly probe the live objects/functions introduced by recent migrations.

**Why:** An unapplied migration can leave the database healthy and most regression tests green while a specific operator workflow or concurrency guarantee is absent in production.

**How to apply:** Treat any local/remote migration gap as a release blocker until the controlled migration process closes it and the newly introduced live objects are rechecked.