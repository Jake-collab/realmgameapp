# Geo-Quest Validation Testing (Prompt 10)

## Unit Tests

Run the Quest Map unit tests:
```bash
pnpm --filter @workspace/mobile test questMap
```

**Coverage:**
- Bounding box validation and scraping prevention (giant bbox rejected)
- Coordinate rounding for cache key safety (2dp grid)
- Distance calculation and formatting (haversine, miles/km labels)
- Location freshness checks
- Accuracy classification (excellent/good/fair/poor/unacceptable)
- Filter counting and serialization
- Validation response mapping
- Privacy assertion (no geometry in responses)
- Dev fixture safety (no private fields)

## Integration Tests (Require Live Supabase)

Integration tests for `validate_geo_quest_location` require a local Supabase instance with migration 020 applied.

### Setup

```bash
supabase start
supabase db reset
```

### Test Scenarios to Verify Manually

1. **Valid location inside region** → result: `validated`
2. **User outside region** → result: `outside_region` (no distance-to-boundary in response)
3. **Poor accuracy** → result: `accuracy_insufficient` (no threshold value in response)
4. **Stale reading (>120s old)** → result: `location_stale`
5. **Future timestamp** → result: `location_stale` + `is_suspicious = TRUE`
6. **Duplicate request_id** → returns original result (idempotent)
7. **Rate limit exceeded** → result: `rate_limited` after 10 attempts in 5 minutes
8. **Wrong user** → not found (participation lookup fails by design)
9. **Completed participation** → result: `invalid_state`
10. **No geometry configured** → result: `not_required`
11. **Suspended account** → result: `invalid_state`
12. **Unauthenticated call** → result: `invalid_state` (auth.uid() is null)

### Verifying Privacy

```sql
-- Confirm geometry is never in response
SELECT validate_geo_quest_location(
  'test-participation-id'::UUID,
  NULL,
  40.7812, -73.9665, 10.0,
  NOW()::TIMESTAMPTZ,
  'test-req-001',
  'completion'
);
-- Response MUST NOT contain: center_lat, center_lng, radius_meters, polygon
```

```sql
-- Confirm another user cannot read attempts
SET LOCAL role TO 'authenticated';
SET LOCAL "request.jwt.claims" TO '{"sub": "other-user-id"}';
SELECT * FROM geo_validation_attempts WHERE user_id = 'real-user-id';
-- Must return 0 rows (RLS enforced)
```

### Verifying Scraping Prevention

```sql
-- Giant bounding box should raise exception
SELECT get_geo_quest_viewport(-180, -80, 180, 80, 60);
-- Must raise: 'Bounding box too large'
```

## Development Fixture Validation

```bash
# All fixture quests have valid display coordinates
pnpm --filter @workspace/mobile test questMap -- -t "DEV_GEO_QUEST_FIXTURES"

# All dev validation responses labeled as [DEV]
pnpm --filter @workspace/mobile test questMap -- -t "DEV_VALIDATION_RESPONSES"
```

## Manual Testing Checklist

### Map Screen
- [ ] Opens from Map tab (3rd tab in Quest navigation)
- [ ] Shows `MapDisconnectedState` when token is absent (not a crash)
- [ ] Shows `MapDisconnectedState` when running in Expo Go (not a crash)
- [ ] Top Quest/Hunt selector remains intact
- [ ] No new bottom tabs were added

### Location Permissions
- [ ] Not requested automatically on mount
- [ ] `MapPermissionBanner` appears for not_determined / denied / blocked
- [ ] "Open Settings" shown for blocked state
- [ ] Map remains browsable (search, pan, tap markers) without location
- [ ] Recenter button prompts for permission if not granted

### Map Interaction
- [ ] "Search this area" appears after meaningful pan
- [ ] "Search this area" triggers a new viewport query
- [ ] Existing markers remain visible during refresh
- [ ] Tapping a marker opens `QuestPreviewCard` in bottom sheet
- [ ] Tapping elsewhere does NOT immediately clear selection
- [ ] "View Quest" navigates to existing Quest Detail screen (Prompt 7)
- [ ] Quest Detail receives source: 'map' context

### Bottom Sheet
- [ ] Drag handle collapses / expands
- [ ] Collapsed: shows quest count or selected title
- [ ] Medium: shows preview card + top 3 nearby
- [ ] Expanded: full scrollable nearby list
- [ ] Sort changes order correctly
- [ ] Filter badge shows active count

### Validation Flow
- [ ] Validation button acquires fresh location
- [ ] Low accuracy shows friendly message (no raw meters)
- [ ] Outside region shows friendly message (no distance/radius)
- [ ] Stale reading rejected with message
- [ ] Success advances the quest state
- [ ] Validation never awards points client-side
- [ ] Points only awarded by server completion transaction

### Privacy Verification
- [ ] No console logs of raw user GPS coordinates
- [ ] No map viewport request includes precise GPS in URL/query
- [ ] Validation response contains no center/radius/polygon fields
- [ ] `geo_validation_attempts` rows are private (RLS check)
- [ ] `quest_geo_validation_geometry` returns 0 rows for authenticated client
