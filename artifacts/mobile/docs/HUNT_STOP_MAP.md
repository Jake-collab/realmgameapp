# Hunt Stop Map — Worlds (Prompt 13)

## Overview

Active Hunt stop locations are shown on the Hunt Map (from Prompt 12) for revealed stops only. The Active Hunt screen itself does NOT embed a map — it uses the Hunt Map tab for spatial navigation.

## Public Stop Location Data

```typescript
interface HuntStopPublicLocation {
  stopId: string
  publicLat: number       // display-only coordinate (approximate)
  publicLng: number       // NOT the validation point
  publicRadius: number    // display radius (not validation radius)
  stopTitle: string
  stopRole: StopRole
}
```

`revealedStopLocations` in `ActiveHunt` is populated with public coordinates only for stops whose `progressStatus` is in `['available', 'in_progress', 'awaiting_proof', 'under_review', 'completed']`.

## Security: Two-Coordinate System

Every hunt stop has TWO types of location data:

| Data | Table | Access |
|------|-------|--------|
| `publicLat/Lng/Radius` | `hunt_stops` | Client-readable |
| Validation `lat/lng/radius` | `hunt_stop_geofences` | SERVER ONLY |

The `publicLat/Lng` in `hunt_stops` is an approximate display point (e.g., center of a neighborhood) used for map markers. It is NOT the point the participant must stand at.

The validation geofence in `hunt_stop_geofences` is the actual boundary for `validate_hunt_stop_location`. It is never returned to the client.

## Map Integration

The Hunt Map tab shows:
- All public hunt pins (from map discovery)
- Active participant's revealed stop locations (from `revealedStopLocations`)
- Tapping a revealed stop pin routes to the Active Hunt screen for that stop

The Active Hunt screen does not duplicate the map — it uses the `CurrentCluePanel` as the primary navigation aid.

## Future: Stop Detail Map

A `HuntStopMap` component was specced in Prompt 13 but deferred to a future prompt. When implemented, it will show a small map snippet in the stop detail view with:
- Public location pin (approximate)
- User's current location (device GPS, not stored)
- No validation geometry

## `revealedStopLocations` Population

Currently returns `[]` (placeholder) from `fetchActiveHunt`. Will be populated from `hunt_stop_geofences.public_lat/lng` (distinct from validation geometry) in a future data layer update.
