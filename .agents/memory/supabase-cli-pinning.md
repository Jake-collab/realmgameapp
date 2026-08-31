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

The workspace's preinstalled Supabase CLI can be older than the release pin.
Do not let its presence silently override the requested npm candidate; verify
the resolved version before provisioning. A mismatched CLI and Storage image
can fail on an internal migration before application tests run.

**Why:** This distinguishes a local CLI/Storage image provisioning failure from
a policy or application regression.

**How to apply:** Keep this infrastructure issue separate from Storage policy
assertions, and rerun the disposable suite only after the CLI/image pairing is
known to provision cleanly.

The disposable harness also relies on the pinned CLI's `--agent` start flag; an
older installed CLI can pass version discovery when explicitly overridden but
still fail before containers start because that flag is absent.

**Why:** Version selection and command compatibility are separate gates, so a
candidate run must verify both before interpreting a database-suite result.

**How to apply:** Check `supabase start --help` for the required flags and
ensure Docker or Podman is available before treating the disposable suite as a
product regression.