# Quest Map (Prompt 10)

## Overview

The Quest Map tab (`app/(main)/quest/map.tsx`) provides the full Geo-Quest discovery and validation experience. It uses Mapbox GL (via `@rnmapbox/maps`) to render public Quest markers, clusters, and controls.

## Prerequisite Audit (Prompt 9 Status)

**Prompt 9 was not run before Prompt 10.** All shared map foundation was built in this prompt:

| Prompt 9 Piece                   | Status    | Location                                     |
|----------------------------------|-----------|----------------------------------------------|
| Shared Mapbox provider           | ✅ Built  | `features/maps/MapProvider.tsx`              |
| Map configuration service        | ✅ Built  | `features/maps/config/mapConfig.ts`          |
| Map style/theme support          | ✅ Built  | `mapConfig.ts` (MAP_STYLES)                  |
| Foreground location service      | ✅ Built  | `features/maps/hooks/useForegroundLocation.ts` |
| Permission-state hook            | ✅ Built  | `features/maps/hooks/useLocationPermission.ts` |
| Map viewport state               | ✅ Built  | Screen local state in `quest/map.tsx`        |
| Map camera helpers               | ✅ Built  | Camera ref + setCamera in screen             |
| Coordinate and bounding-box utils| ✅ Built  | `features/maps/utils/geoUtils.ts`            |
| Marker clustering                | ✅ Built  | Mapbox `ShapeSource`+`SymbolLayer` planned   |
| Shared map marker components     | ✅ Built  | `QuestMapMarker` in screen                   |
| Safe development fallback        | ✅ Built  | `MapDisconnectedState.tsx`                   |
| Mapbox env-variable docs         | ✅ Built  | `MAPBOX_PRODUCTION_SETUP.md`                 |
| Geospatial data-security docs    | ✅ Built  | `GEO_VALIDATION_PRIVACY.md`                  |
| PostGIS database functions       | ✅ Built  | Migration 020                                |
| Coordinate privacy boundaries    | ✅ Built  | `features/maps/utils/coordinatePrivacy.ts`   |

## Screen Layout

```
┌─────────────────────────────────────────┐
│  [Search] [Filter]    (top-right icons)  │
│                                          │
│         Mapbox MapView                   │
│   (full-height, behind all overlays)     │
│                                          │
│      [Search this area]  (centered)      │
│                          [↗ Recenter]    │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ ━━━━━ (drag handle)                │  │
│  │  Collapsed: quest count / title    │  │
│  │  Medium:    quest preview card     │  │
│  │  Expanded:  full scrollable list   │  │
│  └────────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

## Module Structure

```
features/maps/                           — Shared map foundation
  config/mapConfig.ts                    — Token, styles, limits
  utils/geoUtils.ts                      — Bounding box, distance, accuracy
  utils/coordinatePrivacy.ts             — Cache key safety, retention policy
  hooks/useLocationPermission.ts         — Expo Location permission state machine
  hooks/useForegroundLocation.ts         — Single validation-purpose location fix
  components/MapDisconnectedState.tsx    — Shown when Mapbox token/module absent
  components/MapPermissionState.tsx      — Permission banner and explainer
  MapProvider.tsx                        — SDK init + context

features/quest-map/                      — Quest Geo Map domain
  types/questMap.types.ts               — All domain types
  queries/questMapKeys.ts               — React Query key factory
  repositories/questMap.repository.ts   — Viewport, nearby, validation RPCs
  hooks/useGeoQuestViewport.ts          — Debounced viewport query
  hooks/useNearbyGeoQuests.ts           — Distance-sorted nearby list
  hooks/useGeoValidation.ts             — Trusted server-side validation flow
  hooks/useMapFilters.ts                — Filter session state
  hooks/usePlaceSearch.ts               — Debounced Mapbox Geocoding search
  components/QuestPreviewCard.tsx       — Selected marker bottom sheet preview
  components/NearbyResultsSheet.tsx     — Collapsed/medium/expanded sheet
  components/MapFilterSheet.tsx         — Filter modal
  components/SearchThisAreaButton.tsx   — Floating "search this area" button
  fixtures/geoQuestFixtures.ts          — Dev-only test fixtures
```

## Navigation

The Quest Map is the third tab in the Quest bottom navigation:

```
Home | Quests | Map | Progress | Profile
```

No new tabs were added. The tab remains exactly at position 3.

## State Ownership

| State              | Owner              |
|--------------------|--------------------|
| Map camera         | Local ref (cameraRef) |
| Selected marker    | Local useState     |
| Bottom sheet state | Local useState     |
| Search text        | Local useState     |
| Active filters     | useMapFilters hook |
| Viewport results   | React Query        |
| Nearby results     | React Query        |
| Permission status  | useLocationPermission |
| User location      | Mapbox UserLocation (in-memory only) |
| Validation result  | useGeoValidation   |

## Related Documentation

- [`GEO_QUEST_DISCOVERY.md`](./GEO_QUEST_DISCOVERY.md)
- [`GEO_QUEST_VALIDATION.md`](./GEO_QUEST_VALIDATION.md)
- [`GEO_VALIDATION_PRIVACY.md`](./GEO_VALIDATION_PRIVACY.md)
- [`GEO_VALIDATION_SECURITY.md`](./GEO_VALIDATION_SECURITY.md)
- [`GEO_VALIDATION_TESTING.md`](./GEO_VALIDATION_TESTING.md)
- [`MAPBOX_PRODUCTION_SETUP.md`](./MAPBOX_PRODUCTION_SETUP.md)
