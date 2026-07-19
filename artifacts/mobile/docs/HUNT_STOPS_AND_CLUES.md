# Hunt Stops and Clues — Worlds

## Stop Model

A Hunt Stop is a physical location checkpoint. Stops have a role (start/waypoint/final), a completion method, and optional geo-validation.

```
HuntStop {
  id, huntId, sortOrder,
  title, description,
  stopRole: start | waypoint | final,
  isOrdered, isRequired, isHidden,
  completionMethod,
  proofRequired,
  serverRevealState: hidden | revealed_to_participant | public,
  safetyNote?, accessibilityNote?,
  estimatedDurationMinutes?
}
```

## Stop Roles

| Role | Description |
|---|---|
| `start` | Starting meeting point. Coordinates may be shared publicly. |
| `waypoint` | Hidden until revealed. Coordinates withheld until server reveals. |
| `final` | Last stop. Often where the hunt concludes and completion is recorded. |

## Completion Methods

| Method | Description |
|---|---|
| `none` | No validation — tap "I'm here" |
| `manual_confirmation` | Self-confirm; no proof required |
| `text` | Written answer submitted for review |
| `image` | Photo proof submitted for review |
| `location` | Server-side GPS containment check |
| `image_and_location` | Photo + location validation |
| `text_and_image` | Both text and image proof |
| `trusted_code` | One-time server-validated code (future) |

## Stop Visibility (Server-Reveal Architecture)

```
server_reveal_state = 'hidden'
  → Stop title visible, coordinates NEVER sent to client
  → Clue content NOT sent to client

server_reveal_state = 'revealed_to_participant'
  → Approximate coordinates sent via Edge Function (Build 5+)
  → Clue content NOW included in authorized client response

server_reveal_state = 'public'
  → Stop is visible to everyone (e.g., a public meeting point)
```

In Build 1, the reveal mechanism is managed by the `complete_hunt_stop` RPC which transitions the next stop to `available` status. The actual coordinate reveal via Edge Function is a Build 5 feature.

## Clue Model

```
HuntClue {
  id, huntStopId, sortOrder,
  clueText,          ← shown when stop is revealed
  imageMediaId,      ← cover image (resolved to URL)
  hintText,          ← NEVER in ActiveHuntClue; requires explicit request
  revealRule: on_stop_reveal | on_request | timed,
  revealAfterSeconds,
  penaltyPoints,     ← future hint penalty system
  isActive
}
```

## Clue Security Rules

1. **`hintText` is never included in `ActiveHuntClue`** — it is always omitted from the `features/hunts/types` layer. Hint access will use a separate explicit RPC in a future prompt.
2. **`clueText` is only included in authorized responses** when `server_reveal_state = 'revealed_to_participant'`.
3. **Locked stops never include clue content** — `ActiveHuntStop.clue` is `null` when `progressStatus = 'locked' | 'not_started'`.
4. **Clue content is never cached** with user-identifiable keys.

## Sequential Clue Release (Ordered Hunts)

1. User completes Stop N via `complete_hunt_stop` RPC.
2. Server marks Stop N as `completed`.
3. Server finds the next stop in `sort_order` and sets `hunt_stop_progress.status = 'available'`.
4. Next refetch of `useActiveHunt` includes the newly revealed stop with its clue content.

## Stop Display Priority (Client)

`getStopDisplayPriority()` classifies stops into display slots:
- `current` — the active stop the participant is working on
- `next` — the first locked stop after the current one
- `completed` — stops already finished
- `locked` — stops not yet accessible

The "next" stop **shows its title and sort position but no clue content**.

## Geofence Privacy

Stop geofences are stored in `hunt_stop_geofences` with three tiers:

| Column | Visible To |
|---|---|
| `public_lat / public_lng` | Map display (approximate location) |
| `validation_point / polygon` | Server only — RLS `USING (FALSE)` |
| `minimum_accuracy_meters` | Server only |

The public display coordinate (`public_lat / public_lng`) is deliberately offset from the precise validation point to protect exact location privacy.
