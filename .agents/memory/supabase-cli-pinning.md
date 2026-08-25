---
name: Pinned Supabase CLI releases
description: How to choose and update the CLI version used by disposable Quest database checks.
---

Use a concrete Supabase CLI release that is published and testable, and keep the
CI pin, local harness default, and testing documentation synchronized.

**Why:** A guessed or unavailable release makes the release gate fail before
database behavior is tested, while an implicit latest version makes unrelated
CLI or container changes look like Quest regressions.

**How to apply:** Before changing the pin, verify the candidate is available
from the supported CLI distribution, run a fresh disposable migration
provisioning check, and run the complete Quest RPC/RLS suite.