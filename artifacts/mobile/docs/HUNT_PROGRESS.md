# Hunt Progress — Feature Overview (Prompt 14)

## Summary

The Hunt Progress experience lives on the **Progress tab** within the Hunt navigator. It gives users a complete view of their Hunt activity: rankings, active Hunt tracking, completion history, stop-level proof history, and point history.

## Three-Section Layout

The screen uses a segmented control with three sections:

| Section | Content |
|---|---|
| **Leaderboards** | Global Hunt rankings by period (week / month / all time) |
| **In Action** | Active and paused Hunts, with pending stop status |
| **Completed** | Completed Hunt history with stop progress and points |

## Default Section Selection (Priority Order)

When the user first opens Progress, the section is selected automatically:

1. **In Action** — if any stop needs resubmission  
2. **In Action** — if any stop is awaiting proof  
3. **In Action** — if any active hunt exists  
4. **In Action** — if any stop is under review  
5. **Completed** — if arriving from a newly-completed Hunt  
6. Last viewed section (stored per session)  
7. **Leaderboards** — default fallback  

## Deep Screens

| Route | Purpose |
|---|---|
| `/hunt-completion-detail/:id` | Full detail for one completed Hunt |
| `/hunt-other-activity/:id` | Withdrawn / removed / cancelled / expired detail |
| `/hunt-submission-history/:id` | Proof submission history per participation |
| `/hunt-point-history` | Hunt-only point ledger history |

## Key Files

- `app/(main)/hunt/progress.tsx` — main screen
- `features/hunts/types/huntProgress.types.ts` — all domain types
- `features/hunts/queries/huntProgressKeys.ts` — React Query keys
- `features/hunts/repositories/huntProgress.repository.ts` — data access
- `features/hunts/hooks/` — all progress hooks
- `components/hunt-progress/` — all UI components
- `supabase/migrations/024_hunt_progress.sql` — all server-side RPCs

## Privacy Guarantees

- No validation geometry (geofence coordinates) ever returned
- No reviewer identity or raw `review_notes` ever exposed
- Locked clue content excluded from all history routes
- Proof is owner-private (signed URL access handled separately)
- Anonymous leaderboard users receive no identifying fields
- Hidden users excluded from public rank (receive private point total)

## Security

All RPCs validate `auth.uid() = p_user_id` and run as `SECURITY DEFINER`. Cross-user access raises an exception. See `HUNT_PROGRESS_SECURITY.md` for details.
