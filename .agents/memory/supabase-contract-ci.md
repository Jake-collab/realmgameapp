---
name: Disposable Supabase contract CI
description: Reliable local Supabase provisioning for the live database contract suite.
---

Local Supabase contract checks should remove the prior project volume, start from
the checked-in configuration so every migration is applied, and wait for
`/auth/v1/health` before running authenticated tests.

**Why:** The Supabase CLI's aggregate container health check can time out during
first-run Auth initialization even though the service becomes usable shortly
afterward. Treating that transient CLI status as the test gate causes flaky
false failures; skipping readiness would hide broken authentication/RLS tests.

**How to apply:** Keep the isolated test harness fail-closed on the real Auth
endpoint, export only the ephemeral local credentials it reports, and always
remove its containers and volumes on exit.