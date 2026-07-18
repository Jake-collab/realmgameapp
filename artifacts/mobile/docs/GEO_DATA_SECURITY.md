# Geo Data Security — Worlds

Geo-quests and hunt stops require precise GPS coordinates for server-side validation,
but exposing those coordinates to clients would ruin gameplay. This document explains
the security architecture.

---

## Three-Layer Security Model

```
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 1: Public Display                                         │
│  quest_locations.public_lat / public_lng                         │
│  hunt_stop_geofences.public_lat / public_lng                     │
│                                                                   │
│  Approximate location (± 500 m) shown on the map marker.         │
│  Safe to return to any authenticated user.                        │
│  Insufficient to cheat — gives area, not exact target.           │
└─────────────────────────────────────────────────────────────────┘
                          ▼ server decision
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 2: Revealed Participant Data                              │
│  Only after server sets:                                         │
│    hunt_stops.server_reveal_state = 'revealed_to_participant'    │
│    hunt_stop_geofences.is_revealed_to_active_player = TRUE       │
│                                                                   │
│  Server Edge Function may then return a slightly more            │
│  accurate location hint to the active participant only.           │
│  This layer does NOT expose the exact validation point.           │
└─────────────────────────────────────────────────────────────────┘
                          ▼ never leaves server
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 3: Server-Only Validation Geometry                        │
│  quest_geofences.validation_point   (PostGIS GEOGRAPHY)          │
│  hunt_stop_geofences.validation_point (PostGIS GEOGRAPHY)        │
│                                                                   │
│  Precise GPS target. Used ONLY in server-side Edge Functions.    │
│  RLS blocks ALL client access (no SELECT policy exists).         │
│  service_role only.                                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Database Tables

### `quest_locations` (public)
- `public_lat`, `public_lng` — approximate; intentionally fuzzed by `public_radius_meters`
- `address_hint` — general description (e.g. "Near City Museum")
- RLS: readable by all authenticated users for published quests

### `quest_geofences` (private)
- `validation_point` — exact PostGIS GEOGRAPHY(POINT)
- `validation_radius_meters` — accuracy threshold for completion
- `validation_polygon` — for complex boundary zones
- RLS: **no permissive policies** — service_role only

### `hunt_stop_geofences` (private)
- `public_lat`, `public_lng` — approximate (Layer 1)
- `validation_point` — exact target (Layer 3)
- `is_revealed_to_active_player` — gates Layer 2 reveal
- `server_validation_only` — always `TRUE`; documentation reminder
- RLS: **no permissive policies** — service_role only

---

## Validation Flow (Build 5+)

```
Client app (GPS signal)
        │
        │  POST /validate-arrival
        │  { hunt_stop_id, lat, lng, accuracy }
        ▼
Edge Function (service_role)
        │
        ├── Load hunt_stop_geofences.validation_point from DB
        │   (never returned to client)
        │
        ├── ST_DWithin(device_point, validation_point, radius)
        │   ↓
        ├── PASS → mark hunt_stop_progress.completed_at
        │         award points via idempotent ledger insert
        │         return { success: true }
        │
        └── FAIL → increment attempt_count
                   return { success: false, hint: "..." }
```

The device-reported latitude/longitude is used ONLY for the `ST_DWithin` check.
It is stored in `hunt_stop_progress.arrived_at` as supporting evidence but is
**not the authoritative completion signal** — only the server's spatial check is.

---

## Why PostGIS?

Plain FLOAT latitude/longitude arithmetic (Haversine formula) works for approximate
distance calculations but is:

1. Complex to implement correctly in SQL
2. Not index-friendly for radius searches
3. Error-prone with projection at different latitudes

`ST_DWithin(geography, geography, meters)` is:

1. Accurate (uses spherical Earth calculations)
2. Index-accelerated via GIST indexes
3. Standard across the geospatial industry

GIST indexes are created on both `quest_geofences.validation_point` and
`hunt_stop_geofences.validation_point` in `013_indexes_and_views.sql`.

---

## Security Audit Checklist

Before deploying any location-validation Edge Function, verify:

- [ ] `quest_geofences` has RLS enabled with zero SELECT policies for non-service_role
- [ ] `hunt_stop_geofences` has RLS enabled with zero SELECT policies for non-service_role
- [ ] The Edge Function uses the service_role client (not the anon client)
- [ ] The validation response never includes the `validation_point` value
- [ ] `hunt_clues.hint_text` is only returned after the reveal rule is satisfied
- [ ] Client-submitted coordinates are treated as untrusted input (supporting evidence only)
- [ ] `hunt_stop_progress.completed_at` is never writable by clients (RLS enforces this)
