# Hunt Point History (Prompt 14)

## Overview

Owner-only view of Hunt-related point ledger entries. Strictly Hunt-only — Quest points never appear here.

**Route:** `/hunt-point-history`

## RPC: `get_hunt_point_history`

Fetches `points_ledger` rows for the current user where:
- `transaction_type = 'hunt_reward'` — direct rewards from completing Hunts
- `transaction_type = 'reversal'` where the reversed transaction was a `hunt_reward`
- `transaction_type = 'admin_adjustment'` (linked to hunt context)

Quest transactions (`quest_participation_id IS NOT NULL`) are never included.

## Data Per Transaction

- `display_label` — human-readable (e.g., "Hunt completion reward", "Hunt reward adjustment")
- `amount` — positive for rewards, negative for reversals
- `hunt_title` — linked Hunt name
- `created_at` — date
- `is_reversed` — true if this transaction was later reversed
- `is_reversal` — true if this transaction reverses another
- `reversed_ledger_id` — links reversal to original

## Net Points

The sum of all `amount` values gives the user's net Hunt point total for the listed period. The screen header shows this total.

## Privacy

- No raw `reason` field (uses `display_label`)
- No internal ledger notes
- No other users' transactions (RLS + `auth.uid()` validation)

## Isolation from Quest

Hunt and Quest point histories are completely separate:
- Different routes (`/hunt-point-history` vs `/quest-point-history`)
- Different queries (filter by `transaction_type = 'hunt_reward'` vs `quest_participation_id IS NOT NULL`)
- Different summary cards (Hunt points vs Quest points)
- No aggregate crosses between the two
