# Social Hunt Invitations — Worlds (Prompt 16)

## Overview

The social layer integrates with the existing Hunt invitation system from Prompt 11/12. Friendship is a prerequisite for Hunt invitations (by default), but friendship alone does not bypass Hunt eligibility or capacity rules.

## Eligibility Checks

The `get_hunt_invitation_eligibility` RPC checks in order:

1. Target user exists and is active
2. Viewer and target are friends
3. No active block in either direction
4. Target's `allow_hunt_invitations_from` setting allows invitations from friends
5. No existing active invitation for this occurrence
6. Target is not already participating in this occurrence
7. Hunt occurrence has not reached max capacity

All checks are server-enforced. The client receives a safe `{eligible: boolean, code: string}` result.

## Eligibility Codes

| Code | Meaning |
|------|---------|
| `eligible` | Invitation can be sent |
| `not_friends` | Must be friends to invite |
| `blocked` | Block in either direction |
| `invitations_disabled` | Target set `allow_hunt_invitations_from = 'nobody'` |
| `already_invited` | Active invitation exists |
| `already_participating` | Target is already in the Hunt |
| `hunt_full` | Occurrence at capacity |
| `target_unavailable` | Target account not found |
| `unauthorized_inviter` | Inviter does not have invitation authority |

## Invitation Permission Setting

Users control who can invite them:

| Setting | Behavior |
|---------|---------|
| `friends` (default) | Friends may invite |
| `nobody` | No invitations accepted |

Future: `friends_and_played_with` (not activated in Build 1).

## Blocks Override Invitations

An active block in either direction prevents Hunt invitations regardless of friendship status. `are_users_blocked()` is checked inside the eligibility RPC.

## Friendship Does Not Bypass Capacity

If a Hunt occurrence is full, a friend invitation is rejected with `hunt_full`. Friendship does not grant capacity exceptions.

## The Actual Invitation

The eligibility RPC only **evaluates** eligibility. The actual invitation is sent using the existing `invite_to_hunt` RPC from Prompt 11 — not a new social system. This maintains a single trusted invite entry point.
