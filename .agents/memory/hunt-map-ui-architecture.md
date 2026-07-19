---
name: Hunt Map UI Architecture
description: Prompt 12 — Hunt Map, Discovery, Detail, Join, Invitation, Ready, My Hunts patterns
---

## Key design decisions

**MyHuntsSummaryEntry vs HuntSummary:**
- `useMyHunts` returns `MyHuntsSummaryEntry[]` — a lean summary with `huntId`, `huntTitle`, `participationId`, `completedStopCount`, `requiredStopCount`, `startsAt`, etc.
- Does NOT have: `title`, `id`, `stopCount`, `estimatedDurationMinutes`, `capacityState`, `participationMode`, `pointsReward`
- For screens needing rich data (hunt-ready, hunt-detail), load `useHuntDetail` using `entry.huntId`

**Why:** `MyHuntsSummaryEntry` is a joined participation+hunt summary optimized for list display, not full detail rendering.

**HuntDetail.safetyNote vs HuntSummary:**
- `safetyNote` is on `HuntDetail` (extends HuntSummary) — NOT on `HuntSummary`
- Don't try to access `.safetyNote` on `HuntSummary` (e.g., from invitation's `huntSummary: HuntSummary | null`)

**requireSupabase vs getSupabaseClient:**
- `lib/supabase/client.ts` exports: `isSupabaseConfigured()`, `requireSupabase()`, `supabase` (nullable)
- There is NO `getSupabaseClient` exported — use `requireSupabase()` in repositories
- `requireSupabase()` throws if credentials absent — always guard with `isSupabaseConfigured()` in query `enabled` prop

**Button component:**
- Only accepts: `children`, `onPress`, `variant`, `size`, `disabled`, `loading`, `fullWidth`, `style`
- Does NOT accept `accessibilityLabel` or `accessibilityHint` — set on wrapper TouchableOpacity if needed

**Hunt Map privacy layers:**
- Server RPC enforces `status = 'active' AND privacy = 'public'` — unlisted/private/invite_only never in map
- `PublicHuntMapItem` type structurally excludes all private fields (validation coords, locked clues, participant lists)
- Display coords are `displayLatitude`/`displayLongitude` — approximate public meeting area, never validation point
- Approximate user location rounded to 2dp via `cacheRoundLatLng` before use as cache key or RPC param

**Route strings:**
- Use `'/(main)/hunt'` NOT `'/(main)/hunt/'` — trailing slash causes TS type error

**Hunt-map feature module:**
- `features/hunt-map/` — mirrors quest-map structure
- Reuses quest-map's `usePlaceSearch`, `SearchThisAreaButton` directly — no duplication
- Uses `huntMapKeys` for stable React Query cache keys
- Bottom sheet states: collapsed(68px) / medium(280px) / expanded(520px)

## Test counts (Prompt 12)
- 17 suites, 607 total (574 passing + 33 skipped)
- huntMapUI.test.ts: 67 tests
