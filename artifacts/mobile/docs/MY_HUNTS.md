# My Hunts

## Overview

My Hunts (`app/(main)/hunt/my-hunts.tsx`) is the second tab of the Hunt mode. It shows a user's personal Hunt activity organized into sections using an internal segmented control.

## Sections

| Section | Key | Content |
|---------|-----|---------|
| Active | `active` | Hunts with active participation (status = 'active' or 'paused') |
| Ready | `ready` | Joined hunts awaiting start |
| Completed | `completed` | Placeholder until Prompt 14 |
| Invitations | `invitations` | Pending and historical invitations |
| Create | `create` | Placeholder until creator system prompt |

Sections are an internal segmented control — NOT bottom tabs. The bottom tabs remain: Map / My Hunts / Progress / Profile.

## Default Section Logic

On load, the active section is resolved in priority order:
1. **Active** — if `myHunts.active.length > 0`
2. **Ready** — if `myHunts.ready.length > 0`
3. **Invitations** — if `pendingInvitations.length > 0`
4. **Active** (fallback) — empty state shown

Default is applied once on first meaningful data load. User's manual selection is preserved during the session.

## Section Badge Counts

Badge counts appear in segmented control:
- **Active**: count of active hunts
- **Ready**: count of ready hunts
- **Invitations**: count of pending invitations only (not historical)

## Active Section

Shows `ReadyHuntCard` for active hunts with "Continue Hunt" action.

"Continue Hunt" routes to `/hunt-active/[participationId]` — controlled placeholder in Prompt 12, full implementation in Prompt 13.

## Ready Section

Uses `ReadyHuntCard` component with full `useStartHunt` integration.

Start eligibility determined by `startModel`:
- `individual` with enough participants → "Start Hunt" button enabled
- `host_controlled` → "Waiting for Host" badge, no start button
- `scheduled` → "Starts Automatically" badge, no start button

## Invitations Section

Shows `InvitationCard` list grouped by status:
- **Pending** — at top
- **History** (declined, accepted, expired, revoked) — at bottom

Each card links to `/hunt-invitation/[invitationId]` for full details.

## Completed Section (Placeholder)

Minimal placeholder until Prompt 14 implements:
- Hunt completion history
- Points earned per hunt
- Stop-level proof status
- Leaderboard access

## Create Hunt Section (Placeholder)

Minimal placeholder until creator system prompt implements:
- Hunt design wizard
- Stop placement
- Occurrence scheduling
- Privacy + join policy settings

## Data Sources

- `useMyHunts({ userId })` — returns `{ active, ready, completed }` summaries
- `useHuntInvitations({ userId })` — returns all invitations for user

Both hooks use React Query with appropriate invalidation from Prompt 11 events.
