# Geo-Quest Validation Security (Prompt 10)

## Trust Boundaries

```
Client (mobile app)
  ↓ submits: participationId, lat, lng, accuracy, capturedAt, requestId
  ↓ NEVER receives: validation geometry, radius, polygon, center coords
  
Supabase RPC (SECURITY DEFINER)
  ↓ authenticates via auth.uid()
  ↓ reads private quest_geo_validation_geometry
  ↓ performs ST_DWithin / ST_Covers
  ↓ returns safe result only
  
quest_geo_validation_geometry (private table)
  ← RLS: USING (FALSE) — no client reads
  ← Only readable by SECURITY DEFINER functions
```

## Security Invariants

The following must NEVER be violated:

1. **Private geometry unreachable by clients.** `quest_geo_validation_geometry` has `USING (FALSE)` RLS. No `SELECT` query from an authenticated client can return rows.

2. **Validation geometry never returned.** `validate_geo_quest_location` returns only the safe `result` field, `validationAttemptId`, `canRetry`, and `userMessage`. No geometry fields.

3. **Client cannot supply a success boolean.** The RPC computes the result. The client's request has no `result` field.

4. **Points not awarded by the client.** Validation marks the step validated; point award occurs in the Prompt 6 trusted completion transaction.

5. **Ownership enforced.** The RPC verifies `quest_participations.user_id = auth.uid()` before loading geometry.

6. **Account status checked.** Suspended or deactivated accounts cannot validate.

7. **Rate limiting is server-enforced.** Client button disable is advisory, not the security boundary.

8. **Service-role credentials absent from client.** `SUPABASE_SERVICE_ROLE_KEY` is never in the app bundle.

9. **Idempotency key scoped to user.** `UNIQUE (user_id, request_id)` prevents cross-user request_id replay.

10. **Dynamic SQL is absent.** All SQL in migration 020 is static — no `EXECUTE format(...)` in validation functions.

## Attack Surface Analysis

| Attack                          | Mitigation                                       |
|---------------------------------|--------------------------------------------------|
| Location spoofing (GPS mock)    | Timestamp checks, anti-spoofing flags, rate limits |
| Velocity impossibility          | Planned for future prompt — attempt records retained |
| Replay attack (reuse old result)| Idempotency key — original result returned, not re-run |
| Cross-user result theft         | `user_id = auth.uid()` enforced in RPC          |
| Brute force location guessing   | Rate limit (10/5min), no distance-to-boundary returned |
| Giant bounding box scraping     | MAX_BBOX_DIAGONAL_DEGREES enforced in viewport RPC |
| Direct table access (geofences) | RLS `USING (FALSE)` on `quest_geo_validation_geometry` |
| Service role in client bundle   | Never put `SUPABASE_SERVICE_ROLE_KEY` in app     |
| Navigation parameter injection  | Quest Detail independently re-fetches authoritative data |

## Anti-Spoofing (Build 1)

Current signals recorded:
- Future device timestamp → `is_suspicious = TRUE`
- Invalid coordinate range → rejected before recording

Planned for future prompts:
- Cross-validation velocity check (impossible jumps)
- Duplicate coordinate pattern detection
- Device integrity provider (App Attest / Play Integrity)
- App version allowlist

**Policy:** Suspicious flags mark for human review. Users are not automatically accused. One noisy GPS reading does not block legitimate users.

## Audit Trail

Every validation attempt is recorded in `geo_validation_attempts`:
- `result` — what the server decided
- `accuracy_category` — quality classification
- `is_suspicious` — anti-spoofing flag
- `request_id` — client-provided idempotency key
- `received_at` — server timestamp

Admin access to this table requires service role (logged in Supabase audit logs).

## No Validation in Development

Development fixtures (`geoQuestFixtures.ts`) NEVER:
- Call the production validation endpoint
- Award production points
- Insert production participation records
- Bypass RLS

The `__devSimulate` function in `useGeoValidation` is gated by `__DEV__` and is absent from production builds.
