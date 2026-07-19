# Quest UI — Worlds

Architecture and component reference for the Quest system UI.

---

## Screen Architecture

The Quest experience is a Stack within a Tabs layout:

```
app/(main)/_layout.tsx           — Root Stack
  app/(main)/quest/_layout.tsx   — Quest Tabs (5 tabs)
    quest/index.tsx              — Home tab
    quest/quests.tsx             — Quests tab  
    quest/map.tsx                — Map tab (placeholder)
    quest/progress.tsx           — Progress tab (placeholder)
    quest/(profile)              — Profile tab
  app/(main)/quest-detail/[questId].tsx       — Full quest info
  app/(main)/quest-active/[participationId].tsx — Active management
  app/(main)/quest-proof/[participationId].tsx  — Proof collection
  app/(main)/quest-completion/[participationId].tsx — Completion result
```

Deep screens appear **over** the tab bar (via Stack push), meaning the tab bar is hidden on those screens.

---

## Navigation

```typescript
// From any tab or quest card:
router.push('/quest-detail/' + questId);

// From Quest Detail (Start Quest):
router.replace('/quest-active/' + participationId);

// From Active Quest:
router.push('/quest-proof/' + participationId);

// From Proof submission:
router.replace('/quest');  // after success
// or:
router.replace('/quest-completion/' + participationId);
```

---

## Key Components

| Component | Location | Purpose |
|---|---|---|
| `ActiveQuestPanel` | `components/quest/` | Dominant home panel for active participation |
| `QuestTypeBadge` | `components/quest/` | Type pill (Daily / Monthly Drop / Geo-Quest) |
| `DifficultyBadge` | `components/quest/` | Visual difficulty indicator |
| `DurationLabel` | `components/quest/` | Estimated time display |
| `AvailabilityNotice` | `components/quest/` | Status chip (Available, In Progress, etc.) |
| `QuestObjectiveView` | `components/quest/` | Single step display with progress |
| `QuestStepList` | `components/quest/` | Ordered objectives with completion progress |
| `ProofRequirementSummary` | `components/quest/` | Proof type + review mode summary |
| `SafetyNotice` | `components/quest/` | Warning block for hazardous quests |
| `LocationSummary` | `components/quest/` | Public location name + distance |
| `SubmissionStatus` | `components/quest/` | Proof submission status display |
| `QuestSkeleton` | `components/quest/` | Loading skeletons per layout section |

---

## Design Tokens

- **Daily quest**: `colors.quest` (orange)
- **Monthly quest**: `colors.primary` (blue)
- **Geo-Quest**: `colors.accent` (green)
- Completion: `colors.success`
- Urgent states: `colors.destructive`

---

## Rules

1. **Never bypass domain hooks.** All data comes from `features/quests/hooks`, never raw Supabase.
2. **One resolver call per screen.** `resolveQuestAction()` is called once and the result drives all button rendering.
3. **Points shown only after server confirmation.** Quest detail shows reward snapshot for display; actual points only on completion screen after `completeQuest()` responds.
4. **Tab structure is fixed.** The 5-tab navigator is not modified by quest flow screens.

---

## Adding a New Quest Screen

1. Create the file at `app/(main)/quest-<name>/[param].tsx`
2. Add a `Stack.Screen` entry in `app/(main)/_layout.tsx`
3. Use `router.push('/quest-<name>/' + param)` from callers
4. Use `useAuth()`, domain hooks — no raw DB calls
