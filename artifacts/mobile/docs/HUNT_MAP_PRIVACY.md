# Hunt Map Privacy

## Privacy Architecture

The Hunt Map enforces a layered privacy model. Server is the authority. Client never trusts client-side filtering alone for privacy decisions.

## Layer 1: Server-Side RPC Enforcement

Both map RPCs (`get_hunt_map_viewport`, `get_nearby_hunts`) enforce:

```sql
WHERE h.status = 'active'
  AND h.privacy = 'public'
```

This means:
- `unlisted` hunts — **never returned**
- `invite_only` hunts — **never returned** (only accessible via invitation detail, not map)
- `private` hunts — **never returned**
- Cancelled hunts — **never returned**
- Inactive (draft) hunts — **never returned**

The RPC is `SECURITY DEFINER`, runs with elevated privileges, and cannot be bypassed by client filtering tricks or manipulated request parameters.

## Layer 2: PublicHuntMapItem Type Contract

`PublicHuntMapItem` is the only type returned from map RPCs. It structurally excludes:

| Excluded Field | Why |
|---------------|-----|
| Validation coordinates (lat/lng) | Used for proximity proof — must never be shared |
| Geofence polygon | Stop validation boundary |
| Validation radius | Anti-spoofing threshold |
| Locked clue content | Only revealed after stop unlock |
| Participant list | PII — individual identities |
| Participant emails | PII |
| Proof submissions | Private content |
| Moderation notes | Internal admin data |
| Creator private info | Only public display name |
| Review configuration | Internal |
| Anti-spoofing settings | Security parameters |

`displayLatitude` and `displayLongitude` are the public approximate coordinates for the start/meeting area. These are never the exact validation location.

## Layer 3: Display Coordinates Are Approximate

The `display_lat` and `display_lng` values in the RPC are sourced from `hunt_stop_geofences.public_lat` and `hunt_stop_geofences.public_lng`. These are:
- Set by the hunt creator as a public meeting area indicator
- Rounded / offset from the exact validation point
- Safe to show on a public map

The actual validation geometry (`lat`, `lng`, `radius`, `polygon`) from `hunt_stop_geofences` is **never selected** in the map RPC queries.

## Layer 4: Capacity Privacy

Capacity is shown in aggregate only:
- `participant_count` (integer — how many have joined)
- `max_participants` (integer — capacity limit)
- `is_full` (boolean — derived)

No participant names, IDs, or emails are returned. The server does not return the participant list even to other authenticated users.

## Layer 5: Invitation Privacy

Invitations are shown only to the invitee. The `get_hunt_map_viewport` RPC joins `user_invitation` only for the currently authenticated user (via `p_user_id`). Other users' invitations are never exposed.

## Layer 6: Authenticated vs. Unauthenticated Users

Both RPCs accept an optional `p_user_id`:
- **Anonymous**: no participation state, no invitation state in response
- **Authenticated**: current-user participation and invitation overlaid on public result

Neither mode exposes private validation geometry.

## Client Security Rules

1. Never pass exact GPS coordinates as cache keys — always use `cacheRoundLatLng`
2. Never show validation coordinates to users
3. Never display locked clue content in discovery screens
4. Never render the private `validationLatitude` / `validationLongitude` fields (they don't exist on `PublicHuntMapItem`)
5. `isSupabaseConfigured()` guard before all hooks

## Test Coverage

`__tests__/huntMapUI.test.ts` includes "PublicHuntMapItem security contract" tests that assert:
- `validationLatitude`, `validationLongitude`, `validationRadius`, `geofencePolygon` are undefined on map items
- `participantEmails`, `participantNames`, `participantList` are undefined on map items
- `lockedClueContent`, `secretClueContent`, `moderationNotes` are undefined on map items
