---
name: Geo Quest Map Architecture
description: Prompt 10 decisions — Mapbox setup, location privacy, validation security, Metro watcher fix, TS gotchas.
---

## Key Decisions

**Mapbox lazy-loaded:** `require('@rnmapbox/maps')` wrapped in try/catch. App never crashes in Expo Go or when token absent. `MapProvider` renders `MapDisconnectedState` when either token or native module unavailable.
**Why:** `@rnmapbox/maps` is a native module — Expo Go cannot load it; dev env often lacks the token.
**How to apply:** Always use `getMapboxGL()` to access the SDK — never import directly.

---

**No raw GPS in cache keys:** All React Query keys use `safeBoundsKey()` / `safeRegionKey()` (2dp rounding ≈ 1km grid).
**Why:** Raw GPS in cache keys creates a permanent movement fingerprint in the React Query cache.
**How to apply:** All hooks that take lat/lng round to 2dp before constructing the query key.

---

**Validation is server-only:** `validate_geo_quest_location` RPC does the spatial check. Client never computes or awards points.
**Why:** Any client-side geometry would reveal the hidden validation region.
**How to apply:** `useGeoValidation` submits to the RPC; response never contains center/radius/polygon.

---

**Display coords ≠ validation geometry:** Public markers show approximate display coordinates. Private geometry is in `quest_geo_validation_geometry` (RLS: `USING (FALSE)`).
**Why:** Revealing the exact validation point allows spoofing without visiting the intended location.

---

**Metro watcher ENOENT fix:** After installing `@rnmapbox/maps`, Metro may fail with ENOENT on `@turf/invariant_tmp_NNN/dist`. Fix: `pnpm install --force`.
**Why:** pnpm creates temp dirs during postinstall that Metro tries to watch before cleanup.

---

**TypeScript gotchas (Prompt 10):**
- `fontFamily.semiBold` (camelCase B) — not `.semibold`. TS2551 if wrong.
- `PermissionDetailsLocationIOS` lacks `.accuracy` — cast `(ios as any)?.accuracy`.
- Expo Router typed route: `/quest-detail/[questId]` with param key `questId` (not `id`).
- `MapContextValue` and `MapLoadState` are NOT exported from MapProvider (interface-only).
- `mapConfig` exports `MIN_DISCOVERY_ZOOM` (not `MIN_SEARCH_ZOOM`), no `NEARBY_RADIUS_METERS`, no `getMapboxToken`.
- `coordinatePrivacy` exports `assertNotValidationRequest` (not `isValidationDestination`).
- `useForegroundLocation` exports `UseForegroundLocationResult` (not `ForegroundLocationResult`).

---

**Coordinate purge is NOT automatic:** `purge_expired_validation_coordinates()` must be scheduled via pg_cron by an operator. Not triggered automatically.
**Why:** Supabase doesn't auto-schedule functions.

---

**`lib/errors/normalizeError.ts` is the shared adapter:** Quest-map repo uses this for Supabase PostgrestError → Error. Domain normalizers (normalizeQuestError etc.) stay in their feature folders.
