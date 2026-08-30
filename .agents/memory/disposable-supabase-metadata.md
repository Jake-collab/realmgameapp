---
name: Disposable Supabase metadata
description: Local disposable Supabase startup must not inherit generated metadata from a linked hosted project.
---

When provisioning a disposable Supabase project, temporarily isolate every generated `.temp` marker, not only the Storage version marker, and restore them after teardown.

**Why:** A linked project's generated metadata can make the local Storage container request an internal migration absent from the selected local image, causing startup to fail before public migrations run.

**How to apply:** Keep the checked-in config and migrations in place, move generated markers to a temporary backup before `supabase start`, and always restore them from the exit trap.