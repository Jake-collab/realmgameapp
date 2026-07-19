# Hunt Ready State

## Overview

The Ready state is the intermediate state between joining a Hunt and actively participating in it. It is represented by the `/hunt-ready/[participationId]` screen.

## When Ready State Occurs

A user enters Ready state when:
- They successfully join a Hunt → `useJoinHunt` returns `{ success: true, participationId }`
- They accept a Hunt invitation → `useAcceptHuntInvitation` returns `{ success: true, participationId }`

## Start Models

The Ready screen renders three variants based on `startModel`:

### Individual Start
- User can tap "Start Hunt" when ready
- Start button is conditionally enabled based on `minParticipants`
- After start: routes to `/hunt-active/[participationId]`

### Scheduled Start  
- Hunt starts automatically at a set time
- "Starts automatically at [time]" message shown
- No "Start Hunt" button — the server triggers the start
- Inform user to be at meeting point

### Host-Controlled Start
- "Waiting for Host" message shown
- No "Start Hunt" button
- Notification will arrive when host starts the hunt

## Minimum Participants Guard

When `startModel = 'individual'` but `currentParticipants < minParticipants`:
- "Waiting for Participants" label shown
- `X of Y ready` display
- Start Hunt button not shown (or disabled)

This check is advisory only — the server performs the authoritative capacity check when `startHunt` is called.

## Screen Content

| Content | Privacy Note |
|---------|--------------|
| Ready status badge | Public state |
| Hunt title | Public |
| "What happens next" — start model explanation | Safe description only |
| Stats: stops, duration, participants | Public aggregate |
| Timing (starts_at) | Public calendar date |
| Points reward | Public |
| Safety notice | General safety message |

**Never shown:**
- Locked clue content
- Future stop locations
- Other participants' identities
- Proof submission examples

## Navigation Out

From the Ready screen a user can:
- "Start Hunt" → `/hunt-active/[participationId]` (when eligible)
- "View Hunt" → `/hunt-detail/[huntId]`
- "Return to My Hunts" → `/(main)/hunt/my-hunts` (My Hunts, Ready tab)
- Back navigation → Previous screen

## Start Confirmation Modal

Before starting, a confirmation modal is shown:
- Hunt stop count + estimated duration
- Safety reminder
- "Not Yet" | "Start Hunt" buttons

This confirms intent and surfaces the safety notice at the critical moment.

## After Start

On successful `useStartHunt`:
- `{ success: true, participationId }` returned
- Navigate to `/hunt-active/[participationId]`
- In Prompt 12: `hunt-active` shows a controlled placeholder
- In Prompt 13: `hunt-active` shows full stop-by-stop gameplay
