# Hunt Domain — Worlds

## Overview

The Hunt domain implements multi-stop scavenger experiences in the Worlds mobile app. A Hunt is a structured sequence (or unordered set) of physical locations that participants must find, visit, and validate to earn points.

## Core Concepts

### Hunt vs. Occurrence
- A **Hunt** is the content definition (title, description, stops, rewards, configuration).
- A **Hunt Occurrence** is a scheduled instance of that definition (specific start time, capacity, reward overrides).
- One Hunt can have many Occurrences (e.g., running monthly). Each Occurrence has its own participant pool.

### Stop Ordering Modes
- **Ordered** (`stop_ordering = 'ordered'`): stops must be completed in `sort_order` sequence. The next stop is revealed (unlocked) only after the previous stop is completed.
- **Unordered** (`stop_ordering = 'unordered'`): all required stops are made available simultaneously at start time. Participants complete them in any order.

### Start Models
- **Individual** (`start_model = 'individual'`): each participant starts independently by tapping "Start Hunt" after joining.
- **Scheduled** (`start_model = 'scheduled'`): all participants are automatically activated at `occurrence.starts_at`.
- **Host-controlled** (`start_model = 'host_controlled'`): only a `co_host` or `creator` role participant may trigger the start.

### Participation Mode
- **Solo**: each player participates independently.
- **Group**: players form groups; group progress is shared (Build 5+).
- **Solo or Group**: Hunt supports either mode.

## File Structure

```
features/hunts/
├── types/          hunt.types.ts        — all domain types
├── constants/      index.ts             — state machines, constants, limits
├── queries/        huntKeys.ts          — React Query key factory
├── repositories/   hunt.repository.ts   — data access layer (RPC + direct queries)
├── services/
│   ├── huntEligibility.service.ts       — join/start eligibility evaluator
│   ├── huntAvailability.service.ts      — availability state evaluator
│   ├── huntActionResolver.ts            — primary action resolver (UI copy lives here)
│   ├── huntStop.service.ts              — stop/clue visibility, completion logic
│   └── huntCompletion.service.ts        — completion readiness + trigger
├── hooks/
│   ├── useHuntAvailability.ts           — query: server availability state
│   ├── useHuntDetail.ts                 — query: full Hunt content
│   ├── useMyHunts.ts                    — query: My Hunts summary
│   ├── useHuntInvitations.ts            — query: pending invitations
│   ├── useActiveHunt.ts                 — query: active Hunt with authorized stops
│   ├── useJoinHunt.ts                   — mutation: join
│   ├── useStartHunt.ts                  — mutation: start
│   ├── useHuntInvitationActions.ts      — mutation: accept / decline invitation
│   ├── useWithdrawFromHunt.ts           — mutation: withdraw
│   ├── useCompleteHuntStop.ts           — mutation: complete a stop
│   ├── useCompleteHunt.ts               — mutation: complete and claim points
│   └── useInviteToHunt.ts               — mutation: invite a user
├── events/         huntEvents.ts        — domain event emitters (analytics/notifications)
├── fixtures/       huntFixtures.ts      — __DEV__ test fixtures (5 Hunt scenarios)
└── index.ts                             — public barrel export
```

## Security Model

| Layer | Enforcement |
|---|---|
| Private stop geometry | `hunt_stop_geofences` RLS USING (FALSE) — no client reads ever |
| Locked clue content | Server controls `server_reveal_state`; client only shows revealed clues |
| Internal moderation notes | `removal_note_internal` never in any API response |
| Completion authorization | Only `complete_hunt` RPC may award points; client cannot write to `points_ledger` |
| Participant removal | Only `creator`/`co_host` role via `remove_hunt_participant` RPC |
| Capacity enforcement | Advisory lock on `join_hunt` + `accept_hunt_invitation` RPCs |

## Database Tables (Migrations 007, 008, 021)

| Table | Purpose |
|---|---|
| `hunts` | Hunt definition (content, config) |
| `hunt_occurrences` | Scheduled instances with own capacity and timing |
| `hunt_stops` | Ordered/unordered stop definitions |
| `hunt_clues` | Clue content per stop (server-reveal-gated) |
| `hunt_stop_geofences` | **PRIVATE** validation geometry — never sent to client |
| `hunt_participants` | Per-user membership records with reward snapshot |
| `hunt_invitations` | Invitation records (inviter-invitee-hunt) |
| `hunt_stop_progress` | Per-participant stop completion state |
| `hunt_prerequisites` | Typed prerequisites (hunt/quest/points/achievement) |
| `hunt_domain_events` | Domain event outbox for future notifications |

## RPCs (SECURITY DEFINER, Build 1)

| RPC | Purpose |
|---|---|
| `get_hunt_availability` | Authoritative state for a Hunt+user pair |
| `join_hunt` | Join + capacity check + reward snapshot + stop init (atomic) |
| `start_hunt` | Activate participation + unlock first stop (ordered hunts) |
| `invite_to_hunt` | Create invitation (authority-checked) |
| `accept_hunt_invitation` | Accept + create participation (idempotent, capacity recheck) |
| `decline_hunt_invitation` | Decline (terminal; separate from withdrawal) |
| `withdraw_from_hunt` | Participant withdraws (idempotent; not for completed) |
| `remove_hunt_participant` | Host/creator removes participant (trusted only) |
| `complete_hunt_stop` | Mark stop complete + unlock next stop (atomic) |
| `complete_hunt` | Completion + points award (idempotent key: `hunt_completion:{id}`) |
| `cancel_hunt_occurrence` | Cancel an occurrence (host/creator only) |
| `get_my_hunts_summary` | User's active/ready/completed/invitations summary |
