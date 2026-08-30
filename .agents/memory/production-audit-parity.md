---
name: Production audit parity
description: Release-audit practice for detecting repository migrations that have not reached the linked Supabase project.
---

Repository-only migration validation can pass while production is still missing a canonical migration or while the remote ledger claims an older migration that did not fully materialize. A complete release audit must compare linked migration history and directly probe the live catalog objects/functions introduced by recent migrations.

**Why:** An unapplied or partially materialized migration can leave the database healthy and most regression tests green while a specific operator workflow or concurrency guarantee is absent in production.

**How to apply:** Treat any local/remote migration gap as a release blocker until the controlled migration process closes it and the newly introduced live objects are rechecked.