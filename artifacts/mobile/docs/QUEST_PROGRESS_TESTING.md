# Quest Progress Testing Guide (Prompt 8)

## Test File

`__tests__/questProgress.test.ts`

Run:
```bash
pnpm --filter @workspace/mobile test questProgress
```

## Coverage Areas

### 1. Priority Ordering

Tests verify `IN_ACTION_GROUP_PRIORITY` ranks statuses correctly:

```
needs_resubmission (50) > awaiting_proof (40) > in_progress (30)
  > started (20) > under_review (10) > rejected (0)
```

### 2. In Action Summary Computation

- Zero items → all-zero summary
- `started` + `in_progress` count toward `totalActive`
- `hasExpiringToday` is true only for items expiring within the next 24 hours
- Past-expired items do not trigger `hasExpiringToday`

### 3. Default Section Selection

Covers the urgency precedence chain:
- `needs_resubmission > 0` → `in_action`
- `awaiting_proof > 0` → `in_action`
- `totalActive > 0` → `in_action`
- `underReview > 0` → `in_action`
- None → `leaderboards`

### 4. Privacy — Safe Review Note

Tests enforce the privacy rule: `review_notes` is only returned for `needs_resubmission` status, truncated to 500 chars, and null for empty/whitespace notes.

### 5. Other Activity Statuses

Verifies `OTHER_ACTIVITY_STATUSES` includes abandoned/expired/rejected but not completed or active statuses.

### 6. canRestart Logic

- Only repeatable + abandoned = can restart
- Repeatable + expired = false
- Non-repeatable + abandoned = false
- Repeatable + rejected = false

### 7. Net Points (Reversal Handling)

Tests the leaderboard/history point netting math:
- Positive reward counts fully
- Reversal reduces net total
- Partial reversal reduces but doesn't zero
- Empty ledger = 0

### 8. QuestCurrentRank Qualification

- 0 points → qualifies = false, rank = null
- Positive points → qualifies = true
- Hidden user with points → qualifies = true, rank = null

### 9. Deadline Warning

Tests `deadlineWarning()` output for:
- null → null
- Past → "Expired"
- < 24 hours → "Expires in Xh"
- 1-3 days → "Expires in Xd"
- > 3 days → null (no warning)

### 10. Leaderboard Period Boundaries

Verifies:
- Week start is Monday (UTC day = 1)
- Week start ≤ today
- Month start is day 1
- Month start ≤ today

### 11. Constants

- `DEFAULT_COMPLETED_FILTER` defaults to all-types, newest-first
- `PROGRESS_PAGE_SIZE` ≤ `LEADERBOARD_PAGE_SIZE` (leaderboard shows more per page)

## Manual Testing Checklist

### Leaderboards Section
- [ ] Period selector changes the query
- [ ] Current user rank appears pinned at top (below period selector)
- [ ] Load more works for leaderboards > 50 entries
- [ ] User with visibility=false sees their points but no public rank
- [ ] User with 0 quest points sees "Complete a Quest to enter" state
- [ ] All Time / Week / Month each show correct totals

### In Action Section
- [ ] needs_resubmission items appear first
- [ ] Urgency dot appears on "In Action" tab when resubmission needed
- [ ] Expiring today warning appears on relevant cards
- [ ] Review note appears only for needs_resubmission status
- [ ] Tapping "Continue" on an active quest goes to quest-active screen
- [ ] Tapping "Submit Proof" goes to quest-proof screen
- [ ] Under Review card shows "Under Review" message without review notes

### Completed Section
- [ ] Filter by quest type works
- [ ] Sort by highest points works
- [ ] Load more appends to list (infinite scroll)
- [ ] Pull to refresh reloads data
- [ ] Tapping a completed row opens completion detail
- [ ] "Other Activity" section shows abandoned/expired entries
- [ ] "Quest Point History" link navigates to point history screen
- [ ] Clear filter resets to default state

### Completion Detail Screen
- [ ] Points shown are awarded_points (confirmed), not snapshot
- [ ] Completed steps listed correctly
- [ ] Proof summary visible (owner only)
- [ ] No review notes or reviewer identity shown
- [ ] "View submission history" link works

### Submission History Screen
- [ ] Submissions shown newest-first
- [ ] Timeline shows correct sequence
- [ ] Review note visible only on needs_resubmission submission
- [ ] under_review submission shows no review note

### Point History Screen
- [ ] Quest rewards and reversals both appear
- [ ] Net points summary reflects reversals correctly
- [ ] Quest titles resolve correctly
- [ ] Load more works

### Other Activity Screen
- [ ] Status correctly shown (Abandoned / Expired / Rejected)
- [ ] No "Completed" language used
- [ ] No celebration UI
- [ ] canRestart badge shown only for repeatable + abandoned
