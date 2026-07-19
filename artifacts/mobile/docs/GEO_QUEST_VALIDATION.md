# Geo-Quest Location Validation (Prompt 10)

## Architecture Overview

All protected location validation occurs server-side. The client:
1. Acquires a fresh foreground location reading.
2. Checks freshness and basic accuracy.
3. Submits to the `validate_geo_quest_location` RPC.
4. Receives a safe result — no geometry returned.

The server:
1. Authenticates the user via `auth.uid()`.
2. Verifies account status (active required).
3. Verifies participation ownership and state.
4. Loads private versioned validation geometry from `quest_geo_validation_geometry`.
5. Checks timestamp freshness (< 120 seconds, no future timestamps).
6. Checks accuracy against Quest-specific threshold.
7. Performs PostGIS containment check (ST_Covers or ST_Distance).
8. Records the attempt in `geo_validation_attempts`.
9. Returns a safe result — private geometry is NEVER returned.

## Validation Types

| Type         | When Used                                  |
|--------------|--------------------------------------------|
| `start`      | Quest requires presence before starting    |
| `step`       | Multi-step quest with step-specific region |
| `completion` | Quest requires presence to complete        |

## Request Contract

```typescript
interface GeoValidationRequest {
  participationId: string;
  questStepId?: string;           // Present for step validation
  latitude: number;               // Exact — sent to trusted backend only
  longitude: number;
  horizontalAccuracyMeters: number;
  capturedAt: string;             // ISO 8601 — device timestamp
  requestId: string;              // Client-generated idempotency key
  validationType: 'start' | 'step' | 'completion';
}
```

## Response Contract

```typescript
interface GeoValidationResponse {
  result: 'validated' | 'outside_region' | 'accuracy_insufficient' |
          'location_stale' | 'not_required' | 'invalid_state' |
          'rate_limited' | 'unavailable';
  validationAttemptId?: string;  // Server-assigned audit ID
  canRetry: boolean;
  userMessage?: string;          // Safe, no hidden geometry details
  retryAfterSeconds?: number;    // Present when rate_limited
}
```

## What Is NEVER Returned

- Exact validation center coordinates
- Validation radius or polygon
- Distance to the hidden boundary
- Anti-spoofing detection thresholds
- Internal suspicious flags
- Raw PostGIS errors

## Freshness and Accuracy

- **Maximum location age:** 45 seconds (configurable per Quest)
- **Maximum accuracy:** 50 meters default (configurable per Quest via `quest_geo_validation_geometry.required_accuracy_meters`)
- Future timestamps are treated as suspicious and rejected
- The server is the authority — client pre-check is advisory only

## Rate Limiting

- Maximum 10 validation attempts per participation per 5 minutes (server-enforced)
- Client enforces a 10-second minimum between retry attempts
- `rate_limited` result includes `retryAfterSeconds`
- Do not rely on disabling the client button as the sole protection

## Idempotency

- Each request includes a client-generated `requestId`
- Duplicate `requestId` per user returns the original result
- Prevents double-submission on network retry

## Point Awards

Location validation does **not** award points directly. Points are awarded by the existing trusted Quest completion transaction from Prompt 6. `validate_geo_quest_location` updates participation state only; point award happens in the completion RPC.

## Anti-Spoofing Signals (Build 1)

The validation RPC records `is_suspicious = TRUE` when:
- Timestamp is in the future (device clock manipulation)
- Coordinates are impossible (outside valid WGS-84 range)

Additional signals are planned for future prompts (velocity checks, duplicate coordinates, device integrity).

## Coordinate Retention

Submitted validation coordinates (`submitted_lat`, `submitted_lng`) are stored in `geo_validation_attempts` for 90 days, then purged by `purge_expired_validation_coordinates()`.

**IMPORTANT:** The purge function is NOT automatically scheduled. An operator must configure a pg_cron job or equivalent scheduled task. See `GEO_VALIDATION_PRIVACY.md` for the required setup.
