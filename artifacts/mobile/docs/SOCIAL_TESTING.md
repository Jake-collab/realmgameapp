# Social Testing — Worlds (Prompt 16)

## Test File

`artifacts/mobile/__tests__/social.test.ts`

## Test Coverage (18 describe blocks, 65+ assertions)

### Type Guards
- `isPublicProfileSelf`, `isPublicProfileUnavailable`, `isPublicProfile`
- Private reason preservation in unavailable result

### Public Profile Projection
- Full profile includes all required display fields
- Email, phone, exact location, authProvider NEVER present
- Friends-only profile hides stats from non-friends
- Bio controlled by `showBio` flag
- Statistics hidden by default

### Relationship States
- All 7 valid states defined
- `blocked_me` is NOT a client-visible state
- `unavailable` is the generic state for not-found and blocked-by-other

### Primary Action Resolver
- `none + requests allowed → add_friend`
- `none + requests disabled → unavailable`
- `outgoing_request → request_sent` with payload
- `incoming_request → accept_request` with payload
- `friends → friends`
- `blocked_by_me → unblock` (requires confirmation)
- `unavailable → disabled`
- `self → self disabled`

### Query Keys
- All namespaces start with 'social'
- Public-profile key is viewer-scoped
- Search key is viewer-scoped
- Keys do not contain email-like strings

### Invalidation Helpers
- Send request: invalidates sent + profile + search
- Accept: invalidates friends + received + profile
- Block/unblock: invalidates friends + search + blocked-users
- Privacy update: invalidates settings + search
- Remove friend: invalidates friends + profile + mutual

### Social Privacy Defaults
- Username discovery enabled
- Display-name discovery disabled
- Friend requests allowed
- Hunt invitations friends-only
- Statistics hidden
- Profile public

### Profile Visibility Labels
- All three modes have readable labels

### Report Reasons
- All reasons have labels
- Harassment, impersonation present
- At least 5 reasons

### Search Configuration
- Minimum chars ≥ 2
- Debounce ≥ 200ms
- Page size 5–50

### Request Configuration
- Pending limit set
- Expiry ≥ 7 days
- Decline cooldown set

### Security Invariants
- No email/phone/dateOfBirth fields on PublicProfile
- `blocked_by_me` shows unblock action, not `blocked_me`
- Unavailable state hides reason
- Mutual-friend count respects permitted flag
- No message/chat actions from resolvePrimaryAction

### Privacy Layer Separation
- Profile visibility ≠ discoverability
- Statistics visibility ≠ profile visibility
- Friend-request permission ≠ discoverability

### Hunt Invitation Eligibility
- Eligible shape correct
- Ineligible codes (blocked, hunt_full, invitations_disabled)
- Hunt_full code means friendship didn't bypass capacity

### Friend Request Eligibility
- Eligible enables send
- already_friends / requests_disabled / blocked / self all disable send

### Stale Time Configuration
- Public profile stale ≤ 5 min
- Public profile stale ≥ 30s

### Cross-system Isolation
- 'social' namespace does not contain 'quest', 'hunt', 'progression'

### Blocking Behavior
- Unblock requires confirmation
- Unavailable state disables all actions

## Running Tests

```bash
pnpm --filter @workspace/mobile test __tests__/social.test.ts
# Or with coverage:
pnpm --filter @workspace/mobile test --coverage __tests__/social.test.ts
```

## Integration Tests

Tests marked `[REQUIRES_DB]` need a Supabase instance with migration 026 applied. They are skipped automatically when `EXPO_PUBLIC_SUPABASE_URL` is absent.

Full integration test coverage should verify:
- RPC authentication enforcement
- Block exclusion in search
- Canonical pair uniqueness
- Request acceptance atomicity
- Privacy-setting enforcement on profile queries
