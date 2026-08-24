# Map Strategy

> Maps are implemented in Build 5. This document defines the approach for AI agents working on that step.

## Platform

**Mapbox SDK for React Native** via `@rnmapbox/maps`

Chosen over Google Maps / Apple Maps because:
- Custom dark map styles (matches game aesthetic)
- Offline tile caching
- Precise boundary drawing for Hunt mode
- Vector tiles (fast, scalable)
- Superior React Native support

**Note:** `@rnmapbox/maps` requires a native build and **cannot run in Expo Go**. Build 5 will require switching to a development build (`npx expo run:ios` / `npx expo run:android`) or using Expo's EAS build service.

## Environment

```
EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.your-token-here
```

Set in `.env` (client-safe public token). Never use the secret token on the client.

## Map Style

Use a custom Mapbox Studio style matching the game's dark palette:
- Background: `#0A0A12`
- Roads: subtle `#2A2A40`
- Water: `#141420`
- Quest waypoints: `#FF6B35` (orange)
- Hunt boundaries: `#00E5A0` (teal)

## Quest Mode Maps

- Show the quest route as a polyline
- Waypoints rendered as custom markers
- Player location shown as a pulsing dot
- Fog-of-war effect (obscure unvisited areas) — future enhancement

## Hunt Mode Maps

- Real-time player positions via Supabase Realtime broadcasts
- Hunt boundary rendered as a filled polygon
- Item locations revealed progressively
- Heatmap overlay for competitive analytics

## Performance

- Tile caching: enable `offlineManager` for areas used in active quests
- Cluster markers when > 20 items visible on screen
- Use `ShapeSource` + `CircleLayer` for player positions (more performant than custom markers)
- Throttle location updates to 1 update/second during active gameplay

## Location Permissions

Implemented in the device-features-and-permissions flow:
- Request `foregroundPermission` for Quest mode (play while app is open)
- Request `backgroundPermission` for Hunt mode (track while minimized)
- Handle denial gracefully — offer a manual check-in fallback

## Integration Point

When implementing Build 5, create:
```
features/maps/
  MapProvider.tsx       # Mapbox initialization + token injection
  hooks/
    usePlayerLocation.ts
    useMapStyle.ts
  components/
    GameMap.tsx         # Base map component used by both modes
    QuestOverlay.tsx    # Quest-specific layers
    HuntOverlay.tsx     # Hunt-specific layers
```
