# Hunt UI Security

## Security Model

The Hunt UI follows the same security philosophy as the Quest UI: trust the server, render only what the server explicitly returns, and never duplicate server-side enforcement on the client.

## Critical Security Rules

### 1. Action Resolver Is the Single Source of Truth

`resolveHuntAction()` from `huntActionResolver.ts` is the only place that maps `HuntAvailabilityState` to a UI action label and type. Components never duplicate this logic.

```typescript
// ✅ Correct
const action = resolveHuntAction({ state, canJoin, canStart, reasonCode, ... });
<HuntPrimaryAction action={action} onPress={handleAction} />

// ❌ Wrong — duplicates resolver logic
if (state === 'available') {
  return <Button>Join Hunt</Button>;
}
```

### 2. No Optimistic Capacity Claims

When joining a Hunt, the server is the authority on whether there is space:

```typescript
// ✅ Correct — server validates
joinMutation.mutate({ huntId, occurrenceId, userId });

// ❌ Wrong — optimistic capacity decrement
setCapacity(prev => prev - 1); // Never do this
```

### 3. No Locked Clue Content in UI

Clue content for hunt stops is locked until the participant reaches the stop. The `PublicHuntMapItem` and `HuntDetail` types structurally exclude locked content. If a field doesn't exist on the type, it cannot be rendered.

### 4. No Private Geometry Rendering

The `HuntMarker` receives `displayLatitude` / `displayLongitude` — approximate public coordinates. The `HuntMarker` never receives or renders `validationLatitude` / `validationLongitude`.

### 5. Safe Participant Display

Participant counts are shown as aggregates only:
```typescript
// ✅ Safe
<CapacityIndicator current={hunt.currentParticipantCount} max={hunt.maxParticipants} />

// ❌ Never do this
<Text>Participants: {hunt.participants.map(p => p.email).join(', ')}</Text>
```

### 6. Inviter Identity is Public-Name Only

```typescript
// ✅ Safe — uses safe fallback
<Text>{invitation.inviterUserId ? 'A fellow adventurer' : 'Worlds Team'}</Text>

// ❌ Leaks PII
<Text>{invitation.inviterEmail}</Text>
```

### 7. isSupabaseConfigured Guard

All hooks that query Supabase check `isSupabaseConfigured()` before enabling:

```typescript
enabled: isSupabaseConfigured() && !!bounds,
```

This prevents crashing with an empty URL when credentials aren't yet set.

### 8. Authentication Gate for Mutations

All mutation hooks (`useJoinHunt`, `useStartHunt`, `useAcceptHuntInvitation`) require an authenticated `userId`. The server validates the JWT. The client never passes a user ID from unauthenticated state.

### 9. Server-Authoritative Join Routing

The join flow never routes to the active hunt screen on optimistic success. It waits for server confirmation and the server-returned `participationId`:

```typescript
onSuccess: (result) => {
  if (result.success && result.participationId) {
    router.push(`/hunt-ready/${result.participationId}`);
  }
  // result.success === false → remain on current screen
}
```

### 10. Controlled Active Hunt Placeholder

The `/hunt-active/[participationId]` screen in Prompt 12 is a controlled placeholder that:
- Shows NO clue content
- Shows NO stop locations
- Shows NO proof requirements
- Only confirms that the participation ID is being tracked

This prevents accidental exposure of gameplay content before the Prompt 13 implementation is complete.

## RLS Coverage

Row Level Security is enforced on all tables:
- `hunts` — public hunts readable by all; private/unlisted only by authorized users
- `hunt_stops` — readable only through RPCs that filter content
- `hunt_stop_geofences` — never directly queried by client; only public_lat/public_lng exposed via RPCs
- `hunt_participants` — users see only their own records (except host)
- `hunt_invitations` — invitee sees own invitations; inviter sees invitations they sent
- `hunt_stop_progress` — participants see only their own progress records

## SECURITY DEFINER Functions

Both map RPCs run as `SECURITY DEFINER`:
```sql
SECURITY DEFINER
SET search_path = public
```

This allows them to join tables with RLS for the purpose of computing safe aggregates, without exposing raw row access to clients.
