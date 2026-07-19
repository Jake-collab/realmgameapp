# Active Hunt UI — Worlds (Prompt 13)

## Overview

The Active Hunt screen (`app/(main)/hunt-active/[participationId].tsx`) is the primary gameplay surface. It replaces the Prompt 11 placeholder with the full stop-by-stop experience.

## Screen Architecture

Single scrollable screen with inline modals. No deep navigation stack during gameplay — modals keep the user immersed.

```
hunt-active/[participationId]    ← Main gameplay screen
hunt-completion/[participationId] ← Post-completion destination
```

## Layout (top to bottom)

1. **ActiveHuntHeader** — compact fixed header: back ← | Hunt Title ●status | ⋯ menu
2. **HuntDeadlineNotice** — shown only when ≤2h remain or expired (amber/red)
3. **CurrentCluePanel** — DOMINANT — stop title, clue text, clue image, safety note
4. **LocationValidationPanel** — inline (shown after Check Location tap)
5. **HuntSubmissionStatus** — shown for under_review/needs_resubmission/rejected stops
6. **HuntProgressSummary** — "2 of 5 required stops completed" + progress bar
7. **Primary Action Button** — dynamic label driven by `resolveStopAction`
8. **UnorderedStopSelector** — unordered hunts only; available + completed sections
9. **Hunt-Level Completion** — "Complete Hunt" button + readiness banner (when all stops done)

## View Mode State Machine

```
participationStatus → viewMode
  'active'    → main gameplay
  'paused'    → main gameplay (with pause indicator)
  'completed' → redirect to hunt-completion screen
  'withdrawn' → HuntStatusState (withdrawn)
  'removed'   → HuntStatusState (removed)
  other       → HuntStatusState (not_found)
```

## Polling

Active hunt data polls every 30 seconds during gameplay to pick up:
- Stop status changes from reviewer decisions (under_review → completed/needs_resubmission)
- Group member completions (for group hunt summary)
- Deadline changes

## Key Components

| Component | Purpose |
|-----------|---------|
| `ActiveHuntHeader` | Back + title + status + "⋯" menu (withdraw, details, safety) |
| `CurrentCluePanel` | Dominant clue display — stop title, clue text/image, safety |
| `HuntProgressSummary` | Required stops completed / total + progress bar |
| `HuntDeadlineNotice` | Deadline warning when ≤2h remaining |
| `ActiveHuntSkeleton` | Layout-matched loading skeleton |
| `HuntStatusState` | Full-screen terminal state (withdrawn, removed, expired) |
| `UnorderedStopSelector` | Stop picker for unordered hunts |
| `LocationValidationPanel` | Location check result + retry/settings |
| `HuntProofDraft` | Text input + image picker composition UI |
| `HuntProofReview` | Pre-submission review modal |
| `HuntSubmissionStatus` | Under review / needs resubmission status + resubmit action |
| `WithdrawalConfirmation` | Withdrawal modal with consequences clearly listed |
| `HuntCompletionSummary` | Post-completion stats + navigation |

## Navigation

- Back → `/(main)/hunt/my-hunts`
- View Hunt Details → `/(main)/hunt-detail/[huntId]`
- Post-completion → `/(main)/hunt-completion/[participationId]` (via router.replace)
