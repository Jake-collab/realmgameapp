---
name: Supabase audit findings
description: Durable validation lessons for migration parity, partial-index conflict targets, and service-role grants in this project.
---

## Rules

Do not treat a live function with an old implementation as proof that the current migration is applied. Compare the linked migration history and inspect the live function body/schema objects; older definitions can mask missing later migrations.

**Why:** The production project exposed an older rejected-media candidate function while the current migration history stopped before the claim/completion cleanup contract.

**How to apply:** Every final Supabase audit must verify the latest local migration is recorded remotely and that each newly introduced table/function/policy is present in the live schema.

PostgreSQL partial unique indexes cannot be named by `ON CONFLICT ON CONSTRAINT`; use a matching column/expression conflict target or create a real unique constraint when the RPC relies on conflict handling.

**Why:** The live social request RPC failed for every new request because it named a partial unique index as though it were a constraint.

**How to apply:** Review conflict clauses in migrations and run at least one disposable authenticated round-trip for each server-authoritative RPC family.

One-time service-role grant loops do not grant privileges to RLS tables created by later migrations.

**Why:** Scheduler tables created after the privilege-restoration migration were inaccessible to the service-role REST path used by queue health checks.

**How to apply:** Each migration that creates a server-read table must grant the required service-role privileges itself, or a later privilege migration must explicitly cover the complete table set.

Application tables created for trusted-only moderation, integrity, or queue work still need explicit RLS enablement; withholding client table grants is not a substitute when the project contract requires RLS on every table. Service-role access must also be granted explicitly where the trusted API uses those tables.

**Why:** The production audit found four moderation/integrity tables without RLS and without service-role REST privileges. They were inaccessible to ordinary clients, but the missing RLS and trusted access still violated the security contract and broke the server persistence path.

**How to apply:** For every new application table, verify `relrowsecurity = true`, deny ordinary-client reads/writes, and exercise the intended service-role path before declaring schema/security parity.

Check both local filenames and the linked migration ledger before choosing a new migration number; concurrent task merges can reserve a version that is not visible in an earlier local snapshot.

**Why:** The scheduler privilege migration occupied 058 while the friend-request repair was being prepared, so the repair needed the next available version.

**How to apply:** Re-list migrations immediately before pushing and move the new migration to the next unused version rather than reusing a collision.

Applied Supabase migrations should remain immutable; ship corrections to an already-recorded migration as a new forward migration.

**Why:** Rewriting an applied migration can make local history diverge from the linked project and can prevent a clean, auditable deployment.

**How to apply:** Preserve the original migration, add the corrected object definition in the next numbered migration, push it with the linked CLI, and verify remote parity afterward.
