# Achievement Security (Prompt 15)

## Core Invariants

1. **Achievements are awarded server-side only.** No client code ever writes to `user_achievements`.
2. **No duplicate awards.** `UNIQUE (user_id, achievement_id)` enforces this at the DB level. Engine uses `INSERT ... ON CONFLICT DO NOTHING`.
3. **Titles require server-verified unlock.** `set_active_title` RPC checks `user_titles` before updating.
4. **Badges require unlock.** Badges are inserted server-side only via the engine or admin.
5. **Statistics are read-only from the client.** No client path writes to `points_ledger` or any stat source.
6. **Audit preserved.** `achievement_events` records every award event with trigger and payload.

## RLS Policies

| Table | Policy |
|---|---|
| `achievement_definitions` | SELECT: `is_retired = FALSE` (public catalogue) |
| `user_achievements` | SELECT: `auth.uid() = user_id` (owner only) |
| `titles` | SELECT: `is_retired = FALSE` (public catalogue) |
| `user_titles` | SELECT: `auth.uid() = user_id` (owner only) |
| `badges` | SELECT: `is_retired = FALSE` (public catalogue) |
| `user_badges` | SELECT: `auth.uid() = user_id` (owner only) |
| `milestones` | SELECT: `TRUE` (public) |
| `user_milestones` | SELECT: `auth.uid() = user_id` (owner only) |
| `achievement_events` | SELECT: `auth.uid() = user_id` (owner only) |

All INSERT/UPDATE happens via `SECURITY DEFINER` RPCs — not direct client writes.

## What Is Never Exposed

- `rule_key` — internal engine expression (never sent to client)
- `rule_threshold` in raw form — only summarized in `requirementSummary`
- Internal `removal_note_internal` or admin notes
- Other users' achievement data
- Engine evaluation payloads

## Client-Side Checks Are UX-Only

Role and ownership checks in client hooks are UX guards only. All access control is enforced by RLS and SECURITY DEFINER RPCs on the server.
