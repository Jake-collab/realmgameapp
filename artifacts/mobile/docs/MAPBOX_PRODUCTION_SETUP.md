# Mapbox Production Setup (Prompt 10)

## Environment Variables

| Variable                          | Required  | Description                              |
|-----------------------------------|-----------|------------------------------------------|
| `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` | Yes       | Public token (`pk.*`) — safe for client  |
| `EXPO_PUBLIC_MAPBOX_STYLE_LIGHT`  | Optional  | Custom light style URL                   |
| `EXPO_PUBLIC_MAPBOX_STYLE_DARK`   | Optional  | Custom dark style URL                    |

**NEVER use a secret token (`sk.*`) in the client app.**

## Development Setup

1. Create a Mapbox account at https://account.mapbox.com
2. Create a public token with required scopes
3. Add to `.env`:
   ```
   EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.your_token_here
   ```
4. Add to `.env.example` (without the actual value):
   ```
   EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=
   ```

## Development Build Requirement

`@rnmapbox/maps` requires a **native development build** — it does NOT work in Expo Go.

Build for development:
```bash
# iOS
npx expo run:ios --device

# Android
npx expo run:android --device

# Or via EAS
eas build --profile development --platform ios
```

## Disconnected State

When `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` is absent or the native module is unavailable:
- `MapDisconnectedState` is shown instead of the map
- In development: setup instructions are shown
- In production: a generic "Map unavailable" message is shown (no dev instructions)
- The Quests list tab remains fully functional as a fallback
- The app does not crash

## Attribution

Mapbox requires attribution in all maps. `@rnmapbox/maps` shows the Mapbox logo by default (`logoEnabled={true}`). Do not set `logoEnabled={false}` or `attributionEnabled={false}`.

For geocoding (place search), the Mapbox Geocoding API does not require additional in-app attribution beyond the map logo, but review the Mapbox ToS for your usage tier.

## Production Token Configuration

For EAS Build (recommended production workflow):
```bash
eas secret:create --scope project --name EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN --value "pk.your_token"
```

Or in `eas.json`:
```json
{
  "build": {
    "production": {
      "env": {
        "EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN": "@mapbox-access-token"
      }
    }
  }
}
```

## Token Scopes Required

Create a public token with these scopes on Mapbox:
- `styles:read` — map tiles
- `fonts:read` — map labels
- `datasets:read` — if using custom datasets
- `geocoding` — for place search (requires Mapbox Search Box or Geocoding API)

## Billing Notes

Mapbox charges per map load and per geocoding request. For Build 1:
- Map loads: charged per SDK initialization
- Geocoding: charged per search request
- Place suggestions are debounced (400ms) to minimize unnecessary requests
- Viewport queries hit your Supabase backend, not Mapbox — no additional billing

Review https://www.mapbox.com/pricing for current pricing. Mapbox usage is NOT free or unlimited.

## Style URLs

Default styles used when no custom style is configured:
- Light: `mapbox://styles/mapbox/light-v11`
- Dark: `mapbox://styles/mapbox/dark-v11`

Custom styles can be created in Mapbox Studio. Set `EXPO_PUBLIC_MAPBOX_STYLE_LIGHT` / `_DARK` to use them.

## Offline Limitations (Build 1)

- Previously loaded map tiles may remain cached by Mapbox's built-in tile cache
- No explicit offline tile download is implemented in Build 1
- Cached Quest summaries (React Query) are shown when offline
- Protected validation cannot succeed offline — server confirmation is always required
- Full offline support is deferred to Prompt 22

## iOS Setup Notes

For iOS, `@rnmapbox/maps` requires adding the Mapbox token to `Info.plist`:
```xml
<key>MBXAccessToken</key>
<string>$(MAPBOX_ACCESS_TOKEN)</string>
```

This is typically handled by the Expo config plugin. Check the `@rnmapbox/maps` documentation for the current setup steps for your Expo SDK version.

## Offline and Error Handling

| Scenario                        | Behavior                                          |
|---------------------------------|---------------------------------------------------|
| No token                        | `MapDisconnectedState` (token_missing)            |
| No native module (Expo Go)      | `MapDisconnectedState` (module_unavailable)       |
| Token valid, map error          | Error boundary → list fallback                   |
| Network unavailable             | Cached Quest list shown; validation disabled      |
| Geocoding failure               | Search fails silently; manual browsing still works|
