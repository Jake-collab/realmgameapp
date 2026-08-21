# User Discovery — Worlds (Prompt 16)

## Overview

Users can be found through username-based search. Email, phone, exact location, and contact-book data are never used for discovery.

## Search Configuration

| Setting | Value |
|---------|-------|
| Minimum query length | 2 characters |
| Debounce delay | 350ms |
| Max results per page | 20 (server max: 50) |
| Pagination | Cursor-based (last username seen) |
| Authentication required | Yes |

## Search Ranking (Build 1)

1. Exact normalized username match
2. Username prefix match

(Mutual-friend count as tiebreaker is included in the result but not used for primary ranking in Build 1.)

## Discoverability Settings

Each user independently controls:

| Setting | Default | Meaning |
|---------|---------|---------|
| `discoverable_by_username` | `TRUE` | Username prefix searches can find this user |
| `discoverable_by_display_name` | `FALSE` | Display-name search is disabled by default |

A user who sets `discoverable_by_username = FALSE` does not appear in any search results (server-enforced).

## Exclusions (Server-Enforced)

Search results never include:
- The current user themselves
- Suspended or deactivated accounts
- Users the viewer has blocked
- Users who have blocked the viewer
- Users with `discoverable_by_username = FALSE`
- Hidden/private profiles (visibility handled by `get_public_profile`, not search)

## Enumeration Protection

- Authentication required for all search RPCs.
- Minimum query length prevents one-character fishing.
- Result count limited to 50 per page maximum.
- No wildcard `%` prefix search (only suffix wildcard: `username LIKE 'query%'`).
- No "all users" endpoint.
- No email-based search.
- Rate limits applied server-side (exact thresholds not exposed to client).

## Suggested People

Algorithmic "People You May Know" is **not activated in Build 1**. A future signal model may use mutual friends and shared public Hunt participation (when privacy permits). Contact-book import, location history, and email matching are permanently excluded from the suggestion engine.
