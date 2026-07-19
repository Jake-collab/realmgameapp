# Geo-Quest Validation Privacy (Prompt 10)

## Data Minimization Principles

1. **Browsing location is never stored.** GPS readings used only to center the map remain in device memory and are not sent to the server.

2. **Validation coordinates are stored temporarily.** Exact submitted lat/lng are retained for 90 days for fraud review and dispute resolution, then purged.

3. **No continuous location history.** The system has no mechanism to create a timeline of a user's location from map browsing.

4. **Cache keys use rounded coordinates.** React Query keys use ~1 km grid rounding — not raw GPS values.

5. **Approximate display coordinates.** The public Quest map shows display coordinates (public landmark, park centroid, or safe offset) — not the exact validation point.

## What Location Data Is Collected

| Data                    | When             | Stored Where                   | Retention          |
|-------------------------|------------------|--------------------------------|--------------------|
| Map center position     | Browsing         | Device memory only (never DB)  | Session only       |
| Foreground GPS reading  | Validation only  | `geo_validation_attempts`      | 90 days, then purge|
| Approximate region key  | Query caching    | React Query cache (in-memory)  | Session only       |
| Last map camera state   | If user opts in  | AsyncStorage (center+zoom)     | Configurable       |

## What Is NOT Collected

- Continuous location history from map browsing
- Location when the app is in the background
- Route or path taken between quests
- Precise GPS from ordinary screen interactions
- Location from "Find nearest quests" without explicit user action

## Database Tables

### `geo_validation_attempts`

**Purpose:** Audit trail for server-side validation decisions.

**Sensitive fields:**
- `submitted_lat`, `submitted_lng` — exact GPS at time of validation
- `submitted_accuracy_meters` — device-reported accuracy
- `captured_at` — device timestamp of the reading

**Non-sensitive fields:**
- `result` — validation outcome
- `accuracy_category` — derived classification (excellent/good/fair/poor)
- `validation_type` — start/step/completion

**Retention:**
- Exact coordinates purged after 90 days via `purge_expired_validation_coordinates()`
- `accuracy_category` and `result` are retained indefinitely for analytics
- User can request deletion under applicable privacy law

## Scheduled Purge Setup (REQUIRED)

The `purge_expired_validation_coordinates()` function must be called by a scheduled job.

**pg_cron setup (Supabase):**
```sql
SELECT cron.schedule(
  'purge-validation-coordinates',
  '0 3 * * *',  -- 3 AM UTC daily
  'SELECT purge_expired_validation_coordinates()'
);
```

**Manual verification:**
```sql
SELECT COUNT(*) FROM geo_validation_attempts
WHERE coordinates_purge_after <= NOW()
  AND coordinates_purged_at IS NULL;
```

**WARNING:** Exact coordinates are NOT automatically purged until this job is configured. Operators must set this up before production launch.

## Access Controls

- `geo_validation_attempts`: RLS restricts reads to the owning user only
- `quest_geo_validation_geometry`: RLS `USING (FALSE)` — no client reads allowed
- Validation attempt insertion: only via `SECURITY DEFINER` RPC, not direct client insert
- Admin access to attempts requires service role (logged via Supabase audit)

## User Rights

Users may request:
- **Access:** What validation attempts are stored for their account
- **Deletion:** Removal of their validation attempt records
- **Correction:** If a result was incorrect, subject to dispute process

Implement these as admin-mediated operations in the support system (not self-service in Build 1).

## Validation Geometry Privacy

`quest_geo_validation_geometry` is protected by RLS with `USING (FALSE)`. No authenticated client request can read this table. Geometry is accessed only by `SECURITY DEFINER` functions (`validate_geo_quest_location`).

Private geometry is NEVER returned in:
- Validation responses
- Quest detail responses
- Map viewport results
- Navigation parameters
- Deep link parameters
- Logs (console or server)
