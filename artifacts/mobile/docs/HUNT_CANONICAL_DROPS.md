# Canonical Hunt Drops

## One Hunt engine, one Drop model

`hunt_stops` is the canonical Hunt Drop entity. A Drop may be standard, clue-led, or riddle-led; a second Drop table must not be introduced. The active participant's progress remains the source of truth for sequencing and availability.

## Geometry and privacy

Every Drop has four intentionally separate layers:

1. **Public search zone** — an approximate center plus a broad 200–500m radius. This is the only map geometry a participant can receive.
2. **Clue reveal rule** — an optional server-evaluated proximity radius.
3. **Private collection target** — a PostGIS point or polygon available only to trusted database functions.
4. **Collection radius** — a 10–50m server-enforced radius around that target.

Do not return validation points, polygons, exact hidden coordinates, riddle answers, placement media, or other players' collection details to the client. Player coordinates are request-scoped verification inputs; do not place them in local cache keys, analytics events, or logs.

## Collection and riddle flow

Drop collection is online only:

1. The client requests a short-lived collection session after a location check.
2. The database validates the authenticated participant, progress state, GPS accuracy, private target, and collection radius.
3. The client submits the session once. The database validates location again, records an immutable collection, advances progress, and makes an idempotent Hunt-point ledger entry.

Riddle answers are held in the protected answer table and checked through a rate-limited RPC. A correct answer permits the next server-controlled collection step; it is never accepted as a client-side completion claim.

Offline mode may retain drafts and previously authorized public content, but it cannot unlock clues, open a collection session, collect a Drop, validate a placement, or award points.

## Points and leaderboards

Hunt points are separate from Quest points. Per-Drop values are finalised during approval, bounded to 0–200, and Custom Hunt allocations must not exceed the approved 500-point budget. `hunt_point_ledger` is append-only and idempotent; Hunt leaderboards must use valid Hunt ledger events only, never profile totals or Quest events.

## Placement safety

Verified placement requires a short-lived, live capture session with fresh location, acceptable accuracy, a motion sweep, protected media, creator acknowledgement, Mapbox context, image moderation, and optional environment vision.

The placement policy is deterministic:

- **PASS** only with complete, safe, public-access evidence.
- **REVIEW** when evidence is incomplete, uncertain, remote, mismatched, or a provider is unavailable.
- **REJECT** for private residences, roadways, restricted areas, hazardous areas, dangerous visual evidence, rejected media, or invalid coordinates.

Indoor public spaces may be valid but need evidence of public access and a safe placement surface. A provider result is evidence only; all final policy decisions run server-side. A safety report is independent from image moderation and proof validity.

## Versioning and operations

Placement decisions, policy versions, reward versions, and location versions are recorded. Do not silently move a Drop for active participants: resolve an approved relocation as a new location version and preserve the active participant's existing version until a staff decision is made.

The Admin API exposes an authenticated Drop review list, placement diagnostic, relocation-request creation, and safety-report creation. These endpoints intentionally return unavailable rather than synthetic results until trusted Supabase access is connected.