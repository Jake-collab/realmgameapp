# Hunt Detail UI

## Overview

The Hunt Detail screen (`app/(main)/hunt-detail/[huntId].tsx`) shows the full public information for a Hunt, including timing, capacity, requirements, and the primary action button.

## Navigation Entry Points

- Hunt Map marker preview → "Details"
- My Hunts card → "View Hunt"
- Invitation card → "View Hunt" 
- Deep link: `/hunt-detail/[huntId]`
- Notification tap

## Content Sections

| Section | Shown When | Privacy Note |
|---------|------------|--------------|
| Type badge (Official/Custom/Community) | Always | Public |
| Title | Always | Public |
| Summary | Available | Public |
| Availability status banner | State ≠ available | Safe state label |
| Stats grid (stops, duration, points, difficulty) | Always | Public |
| Timing | startsAt or endsAt exists | Public calendar dates |
| Capacity (count/max, participation mode) | Always | Aggregate count only |
| About (description) | Description available | Public |
| Requirements (location/proof) | Requires these | Summary only — not methods |
| Meeting Point | publicMeetingInfo exists | Only public meeting area |
| Accessibility | accessibilityNote exists | Public |
| Safety | safetyNote OR requiresLocation | Public note |
| Created By | creator available | Public display name only |
| Points reward | Always | Public |

## Availability Status Banners

| State | Banner text | Color |
|-------|-------------|-------|
| `active` | ✓ You are actively on this Hunt | Green |
| `ready` | ✓ You have joined this Hunt | Purple |
| `completed` | ✓ You completed this Hunt | Gray |
| `full` | ⊘ This Hunt is full | Red |
| `cancelled` | ⊘ This Hunt has been cancelled | Red |
| `expired` | ⊘ This Hunt has ended | Red |
| `invited` | ✉ You have an invitation to this Hunt | Amber |
| `upcoming` | ◷ This Hunt is not yet open | Purple |

## Primary Action Footer

A sticky footer shows the primary action button, driven by `resolveHuntAction()`. The resolver is the single source of truth — the Detail screen never duplicates action logic.

| Action Type | Button Text |
|-------------|-------------|
| `join_hunt` | Join Hunt |
| `accept_invitation` | View Invitation |
| `continue_hunt` | Continue Hunt |
| `start_hunt` | Start Hunt |
| `view_completion` | View Completion |
| `view_hunt` | View Hunt |
| Full / Cancelled / etc. | Disabled with reason |

## Join Confirmation

Tapping "Join Hunt" opens `HuntJoinConfirmation` modal showing:
- Hunt title + mode + stops + duration
- Timing and capacity
- Location and proof requirements (if any)
- Points reward
- Safety notice (if requiresLocation or safetyNote)

Buttons: "Not Now" | "Join Hunt"

The join mutation is server-authoritative. No optimistic capacity claims.

## Not Found State

When `huntId` is invalid or the hunt is unavailable (ended, cancelled, private):
- Feather alert-circle icon
- "Hunt Unavailable" message
- "Go Back" button
- **Does not attempt to fetch private hunt data**

## What Is Never Shown

- Locked clue content (any stop clue that hasn't been unlocked by the participant)
- Validation geometry (GPS coordinates used for proof validation)
- Private participants list or individual participant identities
- Moderation notes or internal review state
- Anti-spoofing thresholds
- Creator email or private identity details
