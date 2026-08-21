# Social Privacy — Worlds (Prompt 16)

## Overview

Social privacy is controlled by the `social_privacy_settings` table, one row per user, auto-created on profile creation. All settings are server-backed and enforced by SECURITY DEFINER RPCs — the client cannot bypass them.

## Privacy Layers

Privacy controls are **separate** — one master switch would create ambiguous behavior:

1. **Profile visibility** — who can open the full profile
2. **Discoverability** — whether the user appears in search
3. **Friend-request permission** — whether others can send requests
4. **Hunt-invitation permission** — who can invite the user to Hunts
5. **Progression visibility** — title, badges, achievements
6. **Statistics visibility** — quest counts, points
7. **Leaderboard visibility** — inherited from Prompt 8/14 settings
8. **Activity visibility** — reserved for future prompts

## Settings Reference

### Profile Section

| Setting | Default | Description |
|---------|---------|-------------|
| `profile_visibility` | `public` | Who can open your full profile |
| `show_bio` | `TRUE` | Show bio on public profile |
| `show_active_title` | `TRUE` | Show active title |
| `show_badges` | `TRUE` | Show pinned badges |
| `show_achievements` | `TRUE` | Show achievement count and previews |
| `show_statistics` | `FALSE` | Show quest/hunt counts and points (friends-only default) |

### Discovery Section

| Setting | Default | Description |
|---------|---------|-------------|
| `discoverable_by_username` | `TRUE` | Appear in username searches |
| `discoverable_by_display_name` | `FALSE` | Appear in display-name searches |
| `show_mutual_friend_count` | `TRUE` | Show mutual-friend count to others |

### Connections Section

| Setting | Default | Description |
|---------|---------|-------------|
| `allow_friend_requests` | `TRUE` | Others may send friend requests |
| `allow_hunt_invitations_from` | `friends` | Who may send Hunt invitations |

## Privacy Change Behavior

When any privacy setting changes:
- New RPCs enforce the new setting immediately.
- Relevant React Query caches are invalidated (via `getPrivacyUpdateInvalidationKeys`).
- Existing friendships are NOT automatically removed.
- Cached public-profile projections are invalidated.
- Deep links revalidate on next open.

## RLS

The `social_privacy_settings` table has:
- `SELECT` policy: owner only
- `UPDATE` policy: owner only
- No direct `INSERT` from client (trigger auto-creates; RPC upserts)

Other users cannot read any row in `social_privacy_settings` directly. The server uses settings internally during profile and search RPCs.
