---
name: Hosted Supabase reset
description: The hosted project required a scoped application-schema reset because CLI remote reset reaches protected Auth-owned objects.
---

For this hosted project, do not use `supabase db reset --linked` to reset the remote application database. Make a backup, reset only the `public` schema after explicit owner approval, repair the migration journal using exact three-digit versions, and then push the canonical migrations.

**Why:** The project started with a legacy schema and stale migration history. The CLI's linked reset attempts to clean Supabase-managed Auth internals and fails on an Auth-owned refresh-token sequence. The database was successfully reconciled by preserving managed schemas, clearing only `public`, clearing the stale `001`–`049` journal entries, and applying the canonical schema plus RLS and trusted `service_role` table-privilege hardening. RLS bypass alone does not grant PostgreSQL table privileges.

**How to apply:** Treat the migration journal as untrusted if a live schema conflict reappears. Use exact `001`-style version identifiers with `supabase migration repair`; two-digit identifiers do not clear the three-digit history. After any manual schema recreation, verify client RLS policies and explicit `service_role` table privileges before testing trusted API access.