# Supabase Auth Redirects — Worlds

Worlds uses a single redirect policy for Supabase email flows:

- **Native apps:** `worlds://auth-callback`
- **Production web and universal links:** `https://matterrealm.com/auth/callback`
- **Expo web preview:** the current preview origin followed by `/auth/callback`

The native scheme, associated domain, Android App Link filter, and Expo Router
origin are all declared in `app.json`. Both `/(auth)/auth-callback` and
`/(auth)/auth/callback` render the same callback screen, so native and web
links have an explicit route.

## Dashboard configuration

In **Supabase Dashboard → Authentication → URL Configuration**, set:

| Field | Value |
| --- | --- |
| Site URL | `https://matterrealm.com` |
| Redirect URLs | `worlds://auth-callback` |
| Redirect URLs | `https://matterrealm.com/auth/callback` |
| Redirect URLs (preview only) | `https://65c377b8-c26b-4a13-b633-f8b03506805a-00-3bgwekr46jl2n.spock.replit.dev/auth/callback` |

The preview URL is needed only to test the Expo web flow in this workspace.
Do not use a broad production wildcard. If the preview domain changes, replace
the preview entry with the current exact origin plus `/auth/callback`.

OAuth providers are not required and must remain disabled.

## Callback behavior

The callback accepts the two Supabase formats:

```text
worlds://auth-callback#access_token=<TOKEN>&refresh_token=<TOKEN>&type=recovery
https://matterrealm.com/auth/callback?code=<PKCE_CODE>&type=signup
```

- Bearer tokens are accepted only from the URL fragment, not a query string.
- PKCE authorization codes are exchanged with Supabase.
- A recovery callback marks the resulting session as recovery-only before the
  reset screen opens. A normal signed-in session cannot open the reset form.
- Signup and verification callbacks are handed back to the Auth startup state
  machine, which determines whether the user needs verification, onboarding,
  suspension handling, or the main app.
- Invalid, denied, and expired callbacks render a safe error state without
  exposing provider details or creating a redirect loop.

## Email templates

Keep the standard `{{ .ConfirmationURL }}` link in Supabase email templates.
The app supplies `emailRedirectTo`/`redirectTo` for signup, verification resend,
and password reset. If a custom template builds the URL manually, use
`{{ .RedirectTo }}` rather than hard-coding a callback domain.

## Device-link prerequisites

For `https://matterrealm.com/auth/callback` to open a signed mobile build,
matterrealm.com must serve:

- `/.well-known/apple-app-site-association` for iOS
- `/.well-known/assetlinks.json` for Android

The iOS associated domain and Android HTTPS intent filter are already limited
to `matterrealm.com/auth/callback`.