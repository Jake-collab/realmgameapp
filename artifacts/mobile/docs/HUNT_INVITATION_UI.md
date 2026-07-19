# Hunt Invitation UI

## Overview

The Hunt Invitation system allows users to receive, view, accept, and decline Hunt invitations. The full invitation detail screen is at `/hunt-invitation/[invitationId]`.

## Entry Points

- My Hunts → Invitations tab → InvitationCard → "View Invitation"
- Notification tap → deep link `/hunt-invitation/[invitationId]`
- Hunt Detail screen when `invitationStatus = 'pending'` → action button → invitation screen

## InvitationCard (List Row)

Shown in My Hunts → Invitations section. Contains:
- Status badge (Pending / Expired / Declined / Accepted / Revoked)
- Expiry date (if set)
- Hunt title
- Safe inviter identity: "A fellow adventurer" (never email or private ID)
- Meta chips: duration, stop count, capacity, points
- "View Invitation" link

## Invitation Detail Screen

Full screen at `/hunt-invitation/[invitationId]`.

Sections:
| Section | Privacy Note |
|---------|--------------|
| Status badge | Public state only |
| Hunt title + type badge | Public |
| Summary | Public |
| Inviter: "A fellow adventurer" | NEVER exposes email, phone, or private user data |
| Optional message | Only if sender explicitly included it |
| Sent date + expiry | Public timestamp |
| Hunt stops / duration / mode | Public summary |
| Timing | Calendar dates only |
| Capacity | Aggregate count |
| Points reward | Public |
| Safety note | If present |

## Accept Flow

```
User taps "Accept Invitation"
  → useAcceptHuntInvitation.mutate()
  → Server validates: invitation is pending, not expired, capacity available
  → Creates hunt_participant record
  → On success: route to /hunt-ready/[participationId]
  → On failure: remain on invitation screen, show error state
```

## Decline Flow

```
User taps "Decline"
  → Decline confirmation modal opens ("Keep Invitation" | "Decline")
  → User taps "Decline"
  → useDeclineHuntInvitation.mutate()
  → Server updates invitation status to 'declined'
  → On success: route.back() → return to Invitations list
```

## Invitation States

| Status | canRespond | UI |
|--------|-----------|-----|
| `pending` (not expired) | ✓ | Accept / Decline buttons |
| `pending` (expired) | ✗ | "Expired" notice, View Details only |
| `accepted` | ✗ | "You've accepted" notice |
| `declined` | ✗ | "You've declined" notice |
| `revoked` | ✗ | "Invitation was revoked" notice |

## Privacy Rules

- Inviter identity: ALWAYS shown as "A fellow adventurer" — never email or private profile data
- No other invitees visible
- No locked clue content shown in invitation
- No exact validation geometry
- Message (if any): only what the inviter explicitly included in the invitation

## What Is Never Exposed

- The inviter's email address
- The inviter's phone number
- The list of other people invited to the same hunt
- Any locked clue content for hunt stops
- Any private validation geometry
- Internal invitation audit logs
