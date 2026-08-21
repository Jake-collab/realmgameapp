# Social Reporting — Worlds (Prompt 16)

## Overview

Users can report other users from social entry points. Reports are always private — neither the reported user nor other users can see that a report was filed.

## Report Categories

| Reason | Label |
|--------|-------|
| `harassment` | Harassment or bullying |
| `spam` | Spam |
| `impersonation` | Impersonation |
| `inappropriate_profile` | Inappropriate profile content |
| `threatening` | Threatening behavior |
| `scam` | Scam or fraud |
| `other` | Other |

## Entry Points

- Public Profile → Report (secondary action)
- Friend Requests list → View Profile → Report
- Friends list → View Profile → Report

## Privacy Guarantees

- The reported user **never receives** a notification.
- The reported user cannot see the report or the reporter.
- Report status is not publicly visible.
- `reporter_user_id` is protected by RLS — only `service_role` can read it.

## Rate Limits

- Maximum **5 reports per user per day** (server-enforced).
- Returns `{ok: false, code: 'rate_limited'}` when exceeded.

## Data Storage

Reports are stored in the existing `reports` table (migration 010) with `entity_type = 'user_profile'` and `entity_id = target_user_id`.

## Admin Review

The complete admin report-review UI is out of scope for Prompt 16. Reports are accessible via `service_role` for moderation tooling.

## Blocking After Reporting

Reporting does **not** automatically block the reported user. The UI offers a "Block" option after report submission, but it requires the user's explicit action.
