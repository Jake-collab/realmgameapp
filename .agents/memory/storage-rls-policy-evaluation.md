---
name: Storage RLS policy evaluation
description: Prevent anonymous Storage reads from evaluating creator-only authorization helpers.
---

Keep anonymous approved-media access in a separate Storage RLS policy from authenticated
creator/owner access. Do not rely on `auth.uid() IS NOT NULL AND helper(...)` to protect a
helper that anonymous callers cannot execute.

**Why:** PostgreSQL can evaluate both sides of a policy expression. An anonymous request for
a pending Hunt scan then hit a helper-permission error instead of being quietly denied.

**How to apply:** Give anonymous callers only the approved-media predicate. Put any
creator-only function in an `authenticated` policy, and validate the policy against an
anonymous pending object as well as an approved public object.