# Hunt UI Testing

## Test File

`__tests__/huntMapUI.test.ts`

## Test Coverage (Prompt 12)

### Filter Tests
- `countActiveHuntFilters` returns 0 for default filter
- Boolean filters counted individually
- `participationMode` counts as 1 (null = not counted)
- `difficulties` array counts as 1 regardless of size
- Combined filter count
- Null/empty values correctly excluded from count
- `DEFAULT_HUNT_MAP_FILTER` has correct defaults

### Security Contract Tests (PublicHuntMapItem)
- Validation coordinates NOT present on map items
- Private geometry fields NOT present
- Participant identity fields NOT present
- Locked clue content fields NOT present
- Capacity shown in aggregate form only
- Display coordinates correctly named (`display*`, never `validation*`)

### Marker Status Resolution
- Default public hunt → `available`
- Featured (no participation) → `featured`
- `participationStatus = 'active'` → `active`
- `participationStatus = 'accepted'` → `joined`
- `participationStatus = 'completed'` → `completed`
- `isFull = true` → `full`
- `availabilityState = 'upcoming'` → `upcoming`
- Active participation overrides featured

### Action Resolver Integration
- Available + canJoin → `join_hunt` action, enabled
- Full hunt → action disabled
- Active participation → `continue_hunt`
- Ready + canStart → `start_hunt`, enabled
- Invited state → `accept_invitation`
- All states produce non-empty label

### Hunt Availability Evaluation
- Open hunt with space → `available`, canJoin = true
- At capacity → `full`, canJoin = false
- Unauthenticated → NOT_AUTHENTICATED reason
- Active participation → `active` state
- Accepted participation → `ready` state
- Pending invitation → `invited` state
- Null maxParticipants (unlimited) → always canJoin = true

### Invitation Flow Validation
- Pending, not expired → canRespond = true
- Expired (past expiresAt) → canRespond = false
- Declined → canRespond = false
- Accepted → canRespond = false
- Revoked → canRespond = false

### My Hunts Section Logic
- Active hunts exist → default to 'active'
- No active, ready exists → default to 'ready'
- No active/ready, invitations exist → default to 'invitations'
- Nothing exists → default to 'active'
- Priority: active > ready > invitations

### Start Eligibility
- Individual start, enough participants → canStart = true
- Individual start, not enough participants → canStart = false
- Individual start, no min requirement → canStart = true
- host_controlled → always false
- scheduled → always false

### Join Flow Guards
- Unauthenticated + available → cannot proceed to join
- Authenticated + available + space → can proceed
- Authenticated + full → cannot proceed
- Private hunts never in map results (privacy = 'public' filter validated)

### Bottom Sheet State Machine
- expanded.height > medium.height > collapsed.height
- Marker press → medium state
- Deselect → collapsed state

### Sort Orders
- Expected sort options present
- At least 4 options
- Nearest is default

## Running Tests

```bash
pnpm --filter @workspace/mobile test huntMapUI
```

Or all tests:
```bash
pnpm --filter @workspace/mobile test
```

## What Is NOT Tested Here

- Mapbox native rendering (requires device/emulator)
- Real database queries (use Supabase local for integration tests)
- GPS hardware behavior
- Notification delivery
- Animation/transition timing
- Network error retry behavior (covered by React Query)
