# Supabase Setup — Worlds

## Prerequisites

- A Supabase account at [supabase.com](https://supabase.com)
- Node.js 18+ and pnpm installed
- The Supabase CLI: `npm install -g supabase`

---

## Step 1 — Create a Supabase project

1. Log in to [app.supabase.com](https://app.supabase.com)
2. Click **New project**
3. Choose an organisation, give it a name (e.g. `worlds-dev`), set a strong database password, and choose a region
4. Wait for the project to initialise (~2 minutes)

---

## Step 2 — Get your API keys

In your Supabase project, go to **Settings → API**:

| Variable | Where to find it |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Project URL (e.g. `https://xyzxyz.supabase.co`) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `anon` / `public` key |
| `SUPABASE_SERVICE_ROLE_KEY` | `service_role` key — **server-only, never in mobile** |

Copy `.env.example` to `.env.local` and fill these in:

```bash
cp .env.example .env.local
```

> **Security**: The `SUPABASE_SERVICE_ROLE_KEY` bypasses Row Level Security.
> It must only be set on the API server (`artifacts/api-server`), never in the
> mobile app. If it is accidentally bundled in the Expo build, rotate it immediately.

---

## Step 3 — Apply migrations

Migrations are in `supabase/migrations/`. Apply them in order:

### Option A — Via Supabase dashboard SQL editor

Open **SQL Editor** in the Supabase dashboard and paste + run each file in order:

```
001_extensions_and_types.sql
002_profiles_and_settings.sql
003_interests_and_onboarding.sql
004_media_and_storage.sql
005_quests.sql
006_quest_participation_and_proofs.sql
007_hunts.sql
008_hunt_participation.sql
009_points_and_achievements.sql
010_notifications_and_safety.sql
011_admin_and_audit.sql
012_ai_foundation.sql
013_indexes_and_views.sql
014_rls_policies.sql
015_seed_data.sql       ← development only
```

### Option B — Via Supabase CLI (recommended for teams)

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

> **Note**: `015_seed_data.sql` is guarded against production execution.
> The seed script checks `app.environment` and refuses to run if it is `production`.

---

## Step 4 — Create storage buckets

Create the following buckets in **Storage** (Supabase dashboard → Storage → New bucket):

| Bucket name | Public | Purpose |
|---|---|---|
| `avatars` | No | User avatar images |
| `quest-media` | No | Quest cover and instructional images |
| `hunt-media` | No | Hunt cover images |
| `custom-game-media` | No | User-created game media |
| `proof-submissions` | No | Quest and hunt proof files |
| `moderation-quarantine` | No | Content under moderation review |

All buckets are **private by default**. Access is controlled via Storage RLS policies
(see `docs/STORAGE_ARCHITECTURE.md` and `supabase/migrations/004_media_and_storage.sql`).

---

## Step 5 — Regenerate TypeScript types

After applying migrations, regenerate the types file to keep it in sync:

```bash
npx supabase gen types typescript \
  --project-id <your-project-ref> \
  --schema public \
  > lib/supabase/database.types.ts
```

Run this whenever you modify the schema.

---

## Step 6 — Start the app

```bash
pnpm --filter @workspace/mobile run dev
```

The app will now connect to Supabase. The `[Worlds] Authentication setup is pending` message
will no longer appear in the console once credentials are set.

---

## Development without Supabase credentials

The app gracefully degrades when `EXPO_PUBLIC_SUPABASE_URL` is absent:

- Authentication features show a neutral "connecting soon" message
- All UI screens remain navigable
- No crashes or red error screens

This allows UI development and design work without a live Supabase project.

---

## Remaining work (Prompt 4)

- Connect the login/signup forms to `authService.signIn()` / `authService.signUp()`
- Handle email verification flow
- Persist `hasOnboarded` + `activeMode` to `user_settings` via `profileService`
- Wire `NavigationGuard` to the live session from `AuthProvider`
