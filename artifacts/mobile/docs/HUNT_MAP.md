# Hunt Map

## Overview

The Hunt Map (`app/(main)/hunt/index.tsx`) is the primary landing screen when a user enters Hunt mode. It shows publicly available Hunts as map markers, with a collapsible bottom sheet for discovery.

## Architecture

The Hunt Map mirrors the Quest Map architecture exactly. It reuses:
- `MapProvider` + `useMapContext` + `getMapboxGL()` — no second Mapbox provider
- `useLocationPermission` — shared location permission service
- `MapDisconnectedState` / `MapPermissionBanner` — shared components
- `usePlaceSearch` + `SearchThisAreaButton` — shared place search
- `areBBoxesMeaningfullyDifferent` + `cacheRoundLatLng` — shared geo utilities

Hunt-specific additions in `features/hunt-map/`:
- `useHuntMapViewport` — viewport bounding box query (calls `get_hunt_map_viewport` RPC)
- `useNearbyHunts` — sorted nearby list (calls `get_nearby_hunts` RPC)
- `useHuntMapFilters` — local filter state
- `HuntNearbySheet` — bottom sheet for hunt list and preview
- `HuntFilterSheet` — filter modal

## Privacy Contract

The Hunt Map enforces a strict privacy contract:

**Server-side (enforced by RPC):**
- Only `status = 'active'` hunts appear
- Only `privacy = 'public'` hunts appear — unlisted, invite_only, private never visible in map results
- No validation geometry returned (no geofence coordinates or polygon data)
- No locked clue content
- No individual participant data

**Client-side:**
- No private data passed through map components
- Display coordinates are approximate public labels — not validation coordinates
- Capacity shown as aggregate counts only (no per-participant identity)
- Inviter identity in invitation cards uses public display name only

## Camera / Bounds Flow

1. User moves the map → `onRegionDidChange` fires
2. Bounds cached in `pendingBounds`, debounced by `VIEWPORT_DEBOUNCE_MS`
3. After debounce: `activeBounds` updated → React Query viewport cache key changes → new query fires
4. `areBBoxesMeaningfullyDifferent` prevents cache churn from tiny camera movements
5. "Search this area" button appears when pending bounds diverge from active bounds

## User Location

- Rounded to 2dp before use as a cache key or RPC param (privacy: prevents fingerprinting)
- Used for distance display and sort order — NEVER stored on server via this flow
- Initial map center: user location (if permitted), else `DEFAULT_MAP_REGION`

## Bottom Sheet States

| State | Height | Content |
|-------|--------|---------|
| `collapsed` | 68px | Handle + hunt count label |
| `medium` | 280px | Selected hunt preview OR short nearby list |
| `expanded` | 520px | Full nearby list with sort + filter controls |

## Marker Status Mapping

| Marker Status | Color | Icon | Condition |
|--------------|-------|------|-----------|
| `featured` | Orange | star | `isFeatured && !participationStatus` |
| `active` | Hunt green | play-circle | `participationStatus === 'active'` |
| `joined` | Purple | flag | `participationStatus === 'accepted'` |
| `completed` | Muted | check-circle | `participationStatus === 'completed'` |
| `full` | Muted | lock | `isFull && no participation` |
| `upcoming` | Muted | clock | `availabilityState === 'upcoming'` |
| `available` | Hunt green | flag | Default |

Note: Icon AND color used together — never color alone (accessibility requirement).
