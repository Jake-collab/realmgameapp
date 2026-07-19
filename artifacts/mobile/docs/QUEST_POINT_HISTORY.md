# Quest Point History (Prompt 8)

## Overview

The Quest Point History screen (`app/(main)/quest-point-history.tsx`) shows the append-only ledger of all quest-related point transactions for the current user.

## What Is Shown

All rows in `points_ledger` where `quest_participation_id IS NOT NULL` for the authenticated user, ordered newest-first.

This includes:
- `quest_reward` transactions (positive amounts)
- `reversal` transactions linked to quests (negative amounts)
- `admin_adjustment` transactions linked to quests (positive or negative)

## Ledger Semantics

The ledger is **append-only**. Reversals are separate entries with negative amounts — the original positive entry is never modified. The UI shows both as separate rows.

```
Quest reward      +250 pts   [Quest Title]   Jan 15
Quest reward adj  -250 pts   [Quest Title]   Jan 16   ← reversal of above
```

The "Net Quest Points" summary shown at the top is the sum of all displayed amounts — it correctly reflects reversals.

## What Is NOT Shown

- Raw `reason` field from the ledger (internal, potentially sensitive)
- Raw `idempotency_key`
- Other transaction types without `quest_participation_id` (hunt, achievement)
- Other users' entries (RLS enforced)

## Display Labels

| `transaction_type` | Display Label               |
|--------------------|-----------------------------|
| `quest_reward`     | Quest reward                |
| `reversal`         | Quest reward adjustment     |
| `admin_adjustment` | Administrative adjustment   |

## Pagination

Uses `useInfiniteQuery` with `PROGRESS_PAGE_SIZE = 20` rows per page, ordered newest-first. The `PaginationFooter` shows load-more / end-of-list.

## Quest Title Resolution

Quest titles are resolved via a secondary query on `quest_participations` joined to `quests`. This is done in a single batch query after fetching the ledger page, not per-row.

## Hook and Repository

- Hook: `useQuestPointHistory()` → `progressKeys.pointHistory(userId)`
- Repository: `fetchQuestPointHistory(userId, page, pageSize)`
- Stale time: 2 minutes
