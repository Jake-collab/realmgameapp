# Hunt Location Validation UI — Worlds (Prompt 13)

## Overview

Location validation allows the server to confirm a participant is physically present at a stop's required area. The client NEVER knows the validation geofence coordinates or radius.

## Hook: `useValidateHuntStopLocation`

Located at `features/active-hunt/hooks/useValidateHuntStopLocation.ts`

```typescript
const { validationResult, isAcquiring, validate, reset } =
  useValidateHuntStopLocation({ participationId, stopId });
```

### Validation Flow

1. Check foreground location permission (`useLocationPermission`)
2. If denied/blocked → return `permission_denied` outcome immediately
3. Acquire GPS reading via `useForegroundLocation.acquireLocation()`
4. Race against 30s timeout
5. Check reading age (reject if > 120 seconds old)
6. Submit to `validate_hunt_stop_location` RPC (SECURITY DEFINER)
7. Return safe result — no coordinates, no radius exposed

### Validation Outcomes

| Outcome | Cause | User Message |
|---------|-------|-------------|
| `not_started` | Initial state | — |
| `acquiring` | GPS in progress | "Acquiring your location…" |
| `validated` | Within required area | "Location verified." |
| `outside_area` | Not in required area | "You are not in the required area yet." |
| `poor_accuracy` | GPS reading > 100m accuracy | "Move to an open area and try again." |
| `permission_denied` | OS permission denied | "Enable location in Settings." |
| `timeout` | 30s elapsed without fix | "Could not get location. Move to an open area." |
| `rate_limited` | Too many attempts | — |
| `server_error` | RPC failure | "Temporarily unavailable." |
| `stop_unavailable` | Stop expired/locked | — |
| `hunt_expired` | Participation no longer active | — |

## Component: `LocationValidationPanel`

Shown inline in the Active Hunt screen after user taps "Check Location".

- **Never shown on mount** — always requires explicit user action
- Shows acquisition spinner during GPS acquisition
- Shows result with retry/settings actions based on outcome
- "Open Settings" for `permission_denied` state
- "Try Again" for `outside_area`, `poor_accuracy`, `timeout`, `server_error`

## RPC: `validate_hunt_stop_location`

```sql
SECURITY DEFINER
Args: p_participation_id, p_stop_id, p_latitude, p_longitude, p_accuracy_meters
Returns: { success, validated, reasonCode, userMessage }
```

- Computes Haversine distance server-side
- Geofence from `hunt_stop_geofences` — **never returned to client**
- Rejects readings with accuracy > 100m
- Returns safe messages only — no validation geometry exposed

## Accuracy Rules

- Client: max 150m accepted (via `useForegroundLocation` constant)
- Server: max 100m accepted (via RPC constant)
- Server rejects anything worse than 100m horizontal accuracy

## When Called

Location validation is ONLY called when the user explicitly taps the "Check Location" button. It is NEVER called:
- On screen mount
- On background refresh
- During ordinary map browsing
- Automatically on any timer
