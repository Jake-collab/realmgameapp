# Geo-Quest Discovery (Prompt 10)

## Discovery Methods

Users discover Geo-Quests through:

1. **Map viewport** — Quests within the visible map area, loaded via `get_geo_quest_viewport` RPC
2. **Nearby list** — Distance-sorted list in the bottom sheet, loaded via `get_nearby_geo_quests` RPC
3. **Place search** — Mapbox Geocoding search navigates the map; Quest viewport reloads for the new area
4. **Quests tab** — The existing Quest list tab from Prompt 7 remains available for non-map browsing

## Viewport Queries

Viewport queries are:
- **Debounced** (600ms after map movement ends)
- **Bounded** (maximum diagonal of 5 degrees — prevents scraping)
- **Capped** (maximum 60 results per viewport)
- **Cached** (2 minutes stale time — previous data shown during refresh)

The user is shown a **"Search this area"** button when they move significantly from the loaded area. This prevents automatic queries on every frame.

## Display Coordinates vs Validation Geometry

| Coordinate Type         | Visible To    | Purpose                                          |
|-------------------------|---------------|--------------------------------------------------|
| Display coordinate      | All users     | Map marker placement — approximate public point  |
| Validation coordinate   | Server only   | ST_DWithin / ST_Covers check in `quest_geo_validation_geometry` |

Display coordinates may be:
- A public park centroid
- A venue entrance
- A neighborhood center
- A deliberately offset safe point

Display coordinates must NOT:
- Reveal the exact validation point
- Direct users to private property
- Expose sensitive infrastructure

## Marker Clustering

Clustering is handled by Mapbox's native clustering engine:
- `MarkerView` is used for individual markers in Build 1
- For dense marker areas (>20 in viewport), Mapbox's `ShapeSource` + `CircleLayer` + `SymbolLayer` cluster approach is recommended for Prompt 11 optimization

## Marker States

| Status     | Visual Treatment                           | Icon      |
|------------|-------------------------------------------|-----------|
| Available  | Primary color background                   | map-pin   |
| Active     | Accent color background (user in progress) | map-pin   |
| Featured   | Orange (`#FF6B35`)                         | map-pin   |
| Completed  | Muted background                           | map-pin   |
| Upcoming   | Muted background                           | map-pin   |
| Unavailable| Muted background                           | map-pin   |

State is communicated by BOTH color AND marker size (selected = larger). Not color alone.

## Filters

Available map filters:
- Available now (active schedule)
- Quest type (Daily / Monthly)
- Difficulty (Beginner / Intermediate / Advanced)
- Duration (< 30m / < 1h / < 2h)
- Indoor / Outdoor / Both
- Accessibility (accessibility data present)
- Not completed
- In Action (user has active participation)

Filter count is shown on the filter button.

## Distance Display

Distances are:
- **Straight-line** (haversine, not route distance)
- **Labeled as approximate** ("≈" prefix, "approx" suffix)
- **Unit-aware** (miles default for US; km configurable)
- **Not claimed as travel time**
- **Shown as null when user location is unavailable**

## Sorting (Nearby List)

| Sort          | Default When                     | Notes                          |
|---------------|----------------------------------|--------------------------------|
| Nearest       | User location available          | Straight-line distance         |
| Featured      | No location, or user selects     | Featured flag first            |
| Ending soon   | User selects                     | Ascending expiry               |
| Highest points| User selects                     | Descending points              |
| Easiest       | User selects                     | Beginner → Advanced            |
| Shortest      | User selects                     | Ascending estimated duration   |
