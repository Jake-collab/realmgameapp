# Achievement Testing (Prompt 15)

## Test File

`artifacts/mobile/__tests__/progression.test.ts`

Run with:
```
cd artifacts/mobile && pnpm test progression
```

## Coverage Areas

### Achievement Category Constants
- All 7 categories present in ACHIEVEMENT_CATEGORIES
- Every category has a human-readable label
- ACHIEVEMENT_PAGE_SIZE is positive

### Achievement Type Guards
- awardedBy is engine/admin/system only
- isHidden and isSecret are boolean
- Secret achievements have null requirementSummary
- requirementSummary never exposes rule_key or operators
- No internal fields (rule_key, rule_threshold) on client type

### Hidden Achievement Display
- Hidden achievements revealed once unlocked (returned by RPC)
- Locked achievements absent from user_achievements entirely

### Duplicate Prevention
- Achievement IDs and slugs are unique in user list

### Title Invariants
- At most one active title per user
- isActive false by default
- unlockSource excludes "purchase" and "paid"
- Active title swap simulation leaves exactly one active

### Badge Invariants
- No gameplay effect fields
- At most one pinned badge per user
- No account status fields
- artworkUrl is nullable

### Combined Statistics Isolation
- combinedPoints ≥ questPoints + huntPoints
- Quest and Hunt points tracked separately
- totalActivities = questsCompleted + huntsCompleted
- All fields are read-only numeric values

### Progress Overview
- Nullable title and badge fields when none set

### Milestone Classification
- Correct category types and metric keys
- valueAtAward ≥ threshold

### Progression Section Constants
- All 5 section keys present

### Privacy Guards
- No email or identity on achievement records

### Security Invariants
- awardedBy never "client"
- No monetary title or badge fields
- No stat mutation methods
- CombinedLeaderboardEntry exists as interface only (not implemented)

### Cross-System Isolation
- Progression cache namespace is "progression"
- Achievements don't modify quest/hunt points

### Achievement Engine Rule Keys
- All documented rule keys produce human-readable summaries
- Summaries contain no underscores or operators
