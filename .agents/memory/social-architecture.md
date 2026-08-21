---
name: Social Domain Architecture
description: Prompt 16 social layer — public profiles, friendships, friend requests, blocking, privacy settings, user discovery, reporting, Hunt invitation eligibility.
---

## Key decisions

**publicUserRef = username** — opaque public ID used in deep-link routes (`/public-profile/[userRef]`); no internal UUIDs in URLs.

**Canonical pair ordering** — friendships stored with `user_id_a < user_id_b` (UUID lex) via `canonical_pair_a/b` helpers; prevents duplicates without application logic.

**Reverse request → auto-accept** — when A requests B while B already has a pending request to A, the `send_friend_request` RPC atomically accepts both sides. Handled server-side only.

**`blocked_me` never exposed to client** — the client receives `'unavailable'` for both "not found" and "blocked by target"; the 7th relationship state exists only server-side.

**Statistics hidden by default** — `show_statistics = FALSE`; users must explicitly opt-in to show public stats.

**`user_blocks` extended in 026** — added `id` UUID PK, `is_active` bool, `removed_at` timestamptz; old composite PK dropped; partial unique index for active blocks only. `are_users_blocked()` updated to check `is_active = TRUE`.

**Social accent color** — `#7C3AED` (Worlds Purple), consistent with progression layer (`SOCIAL_PURPLE` constant).

**No new bottom tab** — all 6 social screens nested under Profile tab.

## File locations

- Migration: `supabase/migrations/026_social.sql`
- Types: `features/social/types/social.types.ts`
- Repository: `features/social/repositories/social.repository.ts`
- Query keys: `features/social/queries/socialKeys.ts`
- Constants: `features/social/constants/social.constants.ts`
- Hooks: `features/social/hooks/` (19 hooks)
- Components: `components/social/` (16 components)
- Screens: `app/(main)/public-profile/[userRef].tsx`, `friends.tsx`, `friend-requests.tsx`, `find-people.tsx`, `social-privacy.tsx`, `blocked-users.tsx`

## What is NOT yet built (deferred)

- `HuntFriendSelector` component — friend list filtered by Hunt eligibility; hook exists, UI is a stub. Wired fully in Prompt 17 (Hunt creation).
- Settings / Help / Sign Out on profile screen — still `onPress={() => {}}`.

## Why

- blocked_me privacy: revealing "they blocked you" is itself a privacy violation.
- Canonical pairs: avoids two-row race conditions on friendship table without serializable transactions.
- Auto-accept reverse: gives a more natural UX (mutual request = friendship) without extra client round-trips.
