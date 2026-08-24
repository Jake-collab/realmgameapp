# Environment Configuration — Worlds Mobile

This document covers all environment variables and secrets used by the Worlds mobile app, how to configure them for development and production, and how the app behaves when they are absent.

---

## Variable Reference

| Variable | Required | Exposure | Purpose |
|---|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Yes (for auth) | Bundled in app | Supabase project URL (`https://<ref>.supabase.co`) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Yes (for auth) | Bundled in app | Supabase anon/public key — safe to bundle |
| `SUPABASE_SERVICE_ROLE_KEY` | **SERVER ONLY** | **Never bundle** | Server-side admin access — must NOT be in mobile bundle |
| `EXPO_PUBLIC_APP_VERSION` | No | Bundled in app | Version string sent in request headers (`x-app-version`) |
| `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` | No (for maps) | Bundled in app | Mapbox public token for map rendering |
| `EXPO_PUBLIC_MAPBOX_STYLE_LIGHT` | No | Bundled in app | Optional Mapbox light style URL |
| `EXPO_PUBLIC_MAPBOX_STYLE_DARK` | No | Bundled in app | Optional Mapbox dark style URL |
| `EXPO_PUBLIC_MAPBOX_STYLE_SATELLITE` | No | Bundled in app | Optional Mapbox satellite style URL |
| `EXPO_PUBLIC_PRODUCTION_DOMAIN` | No | Bundled in app | Owner-supplied HTTPS domain for universal links |

---

## Setup

### Development

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp artifacts/mobile/.env.example artifacts/mobile/.env.local
   ```

2. Fill in your Supabase project values from the Supabase dashboard:
   - `EXPO_PUBLIC_SUPABASE_URL` — found in Project Settings → API → Project URL
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY` — found in Project Settings → API → anon/public key

3. Restart the Expo dev server:
   ```bash
   pnpm --filter @workspace/mobile run dev
   ```

### Production / CI

Environment variables for production builds are managed via the Replit Secrets panel. Do not commit `.env.local` to source control.

---

## Disconnected Development Mode

When `EXPO_PUBLIC_SUPABASE_URL` or `EXPO_PUBLIC_SUPABASE_ANON_KEY` are absent, the app operates in **disconnected development mode**:

- `isSupabaseConfigured()` returns `false`
- The Supabase client is `null` — no network calls are made
- `AuthProvider` enters `configuration_missing` startup state
- `NavigationGuard` routes to `/(auth)/welcome`
- The login screen shows a neutral informational notice (development only, never in production)
- All auth actions return a "setup is pending" message

This allows the UI to be previewed and developed without a live Supabase project.

---

## SUPABASE_SERVICE_ROLE_KEY Security

**The service role key must never be bundled into the mobile app.**

The service role key bypasses Row Level Security and has full database access. It belongs only on:
- The `api-server` artifact (`artifacts/api-server`)
- CI/CD systems running migrations
- Local Supabase CLI sessions for schema management

Any `EXPO_PUBLIC_*` variable is bundled at build time and visible in compiled JS bundles. The service role key must never use the `EXPO_PUBLIC_` prefix.

---

## How `EXPO_PUBLIC_` Variables Work

Expo reads variables prefixed with `EXPO_PUBLIC_` at build time and replaces references in the JS bundle. This means:

- They are embedded in the app binary — treat them as public
- Changing them requires a new build (not a config update)
- They are safe for non-secret API credentials (Supabase anon key, Mapbox public token)
- They are NOT appropriate for secrets (service role key, webhook secrets, private API keys)

---

## Supabase Client Configuration

```typescript
// lib/supabase/client.ts
createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,    // session persisted to device
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,  // deep links handled by auth-callback.tsx
  },
  global: {
    headers: {
      'x-app-version': process.env.EXPO_PUBLIC_APP_VERSION ?? 'dev',
    },
  },
});
```

---

## Environment File Reference

`.env.example` (committed — no real values):
```bash
# ─── Supabase ─────────────────────────────────────────────────────────────────
# Your Supabase project URL and anon key — safe to bundle (not secrets)
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

# ─── SERVER ONLY — NEVER bundle in the mobile app ─────────────────────────────
# Used by api-server only. Keep in Replit Secrets / CI secrets.
# SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  ← DO NOT USE EXPO_PUBLIC_

# ─── Maps ─────────────────────────────────────────────────────────────────────
# Mapbox public token (Build 5+)
# EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.eyJ1...

# ─── App ──────────────────────────────────────────────────────────────────────
EXPO_PUBLIC_APP_VERSION=1.0.0-dev

# Owner-supplied only after a production domain exists
# EXPO_PUBLIC_PRODUCTION_DOMAIN=YOUR_PRODUCTION_DOMAIN
```

---

## Checking Configuration at Runtime

```typescript
import { isSupabaseConfigured } from '@/lib/supabase/client';

if (!isSupabaseConfigured()) {
  // Show dev notice or return early
}
```

```typescript
import { requireSupabase } from '@/lib/supabase/client';

// Throws with a clear message if not configured
const client = requireSupabase();
```

---

## Production Checklist

Before submitting to App Store / Play Store:

- [ ] `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` set to **production** project values
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is in server secrets only — verify it is NOT in the mobile build
- [ ] `EXPO_PUBLIC_APP_VERSION` matches the version in `app.json`
- [ ] Supabase redirect URLs configured with production domain
- [ ] `associatedDomains` updated with production domain in `app.json`
- [ ] Deep link intent filters updated with production domain in `app.json`
- [ ] Production build tested on real devices (not just Simulator/Emulator)
- [ ] `__DEV__` mode messages (configuration notices) do NOT appear in production build
