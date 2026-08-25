---
name: Hosted Auth URL configuration
description: Limits of the installed Supabase connection for hosted Auth URL settings.
---

Hosted Supabase Auth URL configuration currently requires an owner to edit the
Supabase Dashboard. The installed integration can inspect `/auth/v1/settings`
for provider status, but it does not expose a supported operation to change the
Site URL or redirect URL allowlist.

**Why:** Treating the provider-status endpoint as configuration would create a
false sense that the production redirect policy had been applied.

**How to apply:** When an Auth redirect setting must change, implement and test
the app-side handling separately, then give the owner the exact Dashboard page,
field, and value. Do not enable OAuth providers as a substitute for email-link
configuration.