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

`__tests__/socialRpc.integration.test.ts` exercises the real repository wrappers
against Supabase. It provisions two disposable, email-confirmed users, then
verifies the request → acceptance → friendship flow and the friendship →
block → search exclusion flow from fresh authenticated reads. It also checks
the `get_social_privacy_settings` response for both users.

The test requires a local or CI Supabase project with all migrations applied
through `026_social.sql` (and the migrations that follow it). Use test-only
variable names so a mobile app configuration is not accidentally treated as
an integration target:

```bash
export SOCIAL_TEST_SUPABASE_URL=http://127.0.0.1:54321
export SOCIAL_TEST_SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY"
export SOCIAL_TEST_SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY"

pnpm --filter @workspace/mobile test:integration
```

For the Supabase CLI, the two key values can be obtained with
`supabase status`; do not commit them or print the service-role key in CI logs.
The release-gated disposable Supabase check provisions a fresh local database
from the checked-in migrations, exports the three `SOCIAL_TEST_*` values from
that run's ephemeral `supabase status` output, and runs this suite before
teardown. It also requires the integration variables to be present, so a
broken CI handoff cannot silently turn the release check into a skipped test.
No hosted project or CI database secrets are required. The service-role key is
used only to create/update/delete disposable test users; all social assertions
run through the authenticated mobile client and the production repository RPC
wrappers.

The suite is skipped when any required variable is absent, which keeps the
normal unit-test command safe in disconnected development environments. If all
variables are present but the schema is missing or an RPC contract is wrong, it
fails rather than silently falling back to mocks.

The release-gated integration run verifies:
- RPC authentication enforcement
- Block exclusion in search
- Canonical pair uniqueness
- Request acceptance atomicity
- Repeated opposite-direction request races produce one friendship, no
  pending requests, and one acceptance notification
- Privacy-setting enforcement on profile queries
