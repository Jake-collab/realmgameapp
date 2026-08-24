# Auth Deep Links — Worlds Mobile

This document covers how Worlds handles deep links from Supabase Auth emails (email verification, password reset) and how to configure them correctly for development and production.

---

## Overview

Supabase Auth generates secure links for:
- **Email verification** — sent after sign-up when email confirmation is enabled
- **Password reset** — sent via "forgot password" flow

When the user taps these links from their email client, the OS opens the Worlds app via the `worlds://` URL scheme. The app handles the token exchange in `app/(auth)/auth-callback.tsx`.

---

## URL Scheme

The app is registered for the `worlds://` URL scheme in `app.json`:

```json
{ "scheme": "worlds" }
```

On iOS, universal links (`https://YOUR_PRODUCTION_DOMAIN/...`) are also supported via `associatedDomains` (placeholder until a production domain is set).

On Android, explicit intent filters handle both the `worlds://` scheme and the HTTPS universal link fallback.

---

## Deep Link Format

Supabase sends tokens in the **URL fragment** (`#`) — not query parameters:

```
worlds://auth-callback#access_token=<TOKEN>&refresh_token=<TOKEN>&type=signup
worlds://auth-callback#access_token=<TOKEN>&refresh_token=<TOKEN>&type=recovery
```

The `auth-callback.tsx` screen parses the fragment, extracts tokens, and calls `supabase.auth.setSession()`.

**Why fragments?** Fragments are not sent to servers on redirect — this is a security property that prevents tokens from appearing in server logs.

---

## `app/(auth)/auth-callback.tsx`

The callback screen:
1. Gets the URL that launched it via `Linking.getInitialURL()`
2. Parses the fragment for `access_token`, `refresh_token`, `type`, `error_code`
3. Rejects malformed or expired links cleanly
4. For `type=signup` — exchanges tokens, `onAuthStateChange(SIGNED_IN)` fires, NavigationGuard routes to onboarding
5. For `type=recovery` — exchanges tokens, redirects to `/(auth)/reset-password`

---

## Supabase Project Configuration

**Required setting in your Supabase project dashboard:**

> Authentication → URL Configuration → Redirect URLs

Add the following URLs:

```
# Development
worlds://auth-callback

# Production (update when domain is assigned)
https://YOUR_PRODUCTION_DOMAIN/auth/callback
```

> **Note**: Without these registered redirect URLs, Supabase will reject deep link callbacks with a 400 error. This is a server-side security allowlist.

---

## Email Templates

Supabase's default email templates use `{{ .ConfirmationURL }}`. You must configure custom templates that use the `worlds://auth-callback` redirect URL.

In the Supabase dashboard (Authentication → Email Templates):

**Confirm signup**:
```html
<a href="{{ .ConfirmationURL }}">Verify your email address</a>
```

The `{{ .ConfirmationURL }}` will be set to `worlds://auth-callback#...` when you configure your redirect URL correctly.

**Reset password**:
```html
<a href="{{ .ConfirmationURL }}">Reset your password</a>
```

---

## Development Setup

During development (Expo Go, development builds):
1. Ensure `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` are set
2. Add `worlds://auth-callback` to your Supabase project's redirect URL allowlist
3. On iOS Simulator: universal links do not work — use the `worlds://` scheme
4. On Android Emulator: use ADB intent or deep link via `expo-linking` dev tools

**Testing deep links locally**:
```bash
# iOS Simulator
xcrun simctl openurl booted "worlds://auth-callback#access_token=FAKE&refresh_token=FAKE&type=signup"

# Android Emulator
adb shell am start -W -a android.intent.action.VIEW -d "worlds://auth-callback#access_token=FAKE&refresh_token=FAKE&type=signup"
```

---

## Production Setup

When the production domain is assigned:

1. Update `ios.associatedDomains` in `app.json`:
   ```json
   "associatedDomains": ["applinks:YOUR_DOMAIN"]
   ```

2. Update `android.intentFilters` HTTPS host:
   ```json
   "host": "YOUR_DOMAIN"
   ```

3. Add `https://YOUR_DOMAIN/auth/callback` to Supabase redirect URL allowlist

4. Serve `/.well-known/apple-app-site-association` (for iOS universal links) and `/.well-known/assetlinks.json` (for Android App Links) from your production server

5. Update the `REDIRECT_URL` constant in `verify-email.tsx` and `forgot-password.tsx`:
   ```typescript
   const REDIRECT_URL = 'https://YOUR_DOMAIN/auth/callback';
   ```

---

## Security Notes

- Tokens in URL fragments are never logged by Supabase servers
- `auth-callback.tsx` exchanges tokens exactly once then discards them
- Malformed or expired tokens show an error screen — no redirect loop to self
- The screen never navigates to itself (prevents callback loops)
- `detectSessionInUrl: false` is set on the Supabase client — deep links are handled manually, not automatically
