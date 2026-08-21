# Public Profiles — Worlds (Prompt 16)

## Overview

A public profile is a privacy-filtered view of another user's identity. All data comes from the `get_public_profile` RPC — the client never queries the raw `profiles` table directly.

## Route

`/public-profile/[userRef]` — where `userRef` is the target's **username**.

## Visibility Modes

| Mode | Who Can See Full Profile |
|------|--------------------------|
| `public` | Any authenticated user |
| `friends_only` | Accepted friends only; non-friends see a minimal card |
| `private` | Owner only; others see generic unavailable state |

Discoverability (appearing in search) is a separate setting from profile visibility. A user can be discoverable by username but keep their profile `friends_only`.

## Authorized Fields

| Field | Condition |
|-------|-----------|
| Display name | Always shown (when profile visible) |
| Username | Always shown |
| Avatar | Always shown |
| Bio | `show_bio = TRUE` |
| Active title | `show_active_title = TRUE` |
| Pinned badges | `show_badges = TRUE` |
| Achievement count | `show_achievements = TRUE` |
| Statistics | `show_statistics = TRUE` (default: friends-only) |
| Mutual friend count | `show_mutual_friend_count = TRUE` on both users, not blocked |
| Account age / joined | Shown in full public profile |

## Prohibited Fields (Never Exposed)

- Email address
- Phone number
- Date of birth
- Exact address or GPS location
- Authentication provider
- Account role (`user`, `admin`)
- Account status (`restricted`, `suspended`)
- Moderation history
- Report history
- Active Quest or Hunt participation
- Quest/Hunt proof contents
- Exact completion locations
- Invitation history

## Self-Profile Handling

When the current user opens their own public profile route:
- The RPC returns `{is_self: true, username: "..."}`.
- The screen redirects to the self-Profile tab.
- Preview mode is not yet implemented (Prompt 17).

## Unavailable States

| Code | Shown To User | Cause |
|------|--------------|-------|
| `not_found` | "Profile Unavailable" | Username not found or account deactivated |
| `unavailable` | "Profile Unavailable" | Blocked by the target (hides block status) |
| `private` | "Private Profile" | Target's visibility is private and viewer is not a friend |

The client cannot distinguish `not_found` from `blocked_by_target` by design.

## Deep Link Safety

Deep links to `/public-profile/[userRef]` revalidate:
- Account existence and status
- Block status in both directions
- Profile visibility against current relationship
- Parameter validity (username format)

Stale cache is not served after a block or privacy change.
