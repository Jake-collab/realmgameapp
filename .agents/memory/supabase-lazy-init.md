---
name: Supabase lazy init
description: Supabase createClient throws synchronously on empty URL — must null-guard when credentials are absent.
---

**Rule:** Never call `createClient(url, key)` when `url` is an empty string — it throws `supabaseUrl is required` synchronously, crashing the app at module load time.

**Why:** `@supabase/supabase-js` validates the URL in the constructor. In development without credentials configured, `process.env.EXPO_PUBLIC_SUPABASE_URL` resolves to `undefined` → `""`.

**How to apply:** Pattern used in `services/supabase.ts`:
- Check `Boolean(url && key)` before calling `createClient`
- Export `supabase` as `SupabaseClient | null`
- Export `requireSupabase()` that throws a descriptive error
- Export `isSupabaseConfigured()` for guards in AuthProvider
- AuthProvider checks `authService.isConfigured()` before any Supabase call and falls back to UNAUTHENTICATED state gracefully
