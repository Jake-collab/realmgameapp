# Quest Action Resolver — Worlds

The single source of truth for mapping quest state to UI actions.

---

## Location

`features/quests/utils/questActionResolver.ts`

---

## API

```typescript
import { resolveQuestAction } from '@/features/quests/utils/questActionResolver';

const action = resolveQuestAction({
  availabilityState: 'active',
  participationStatus: 'awaiting_proof',
});
// → { label: 'Submit Proof', actionType: 'submit_proof', enabled: true, isMutation: false }
```

### Input

```typescript
interface QuestActionInput {
  availabilityState: QuestAvailabilityState;
  participationStatus?: ParticipationStatus | null;
  proofStatus?: ProofSubmissionStatus | null;
  reasonCode?: EligibilityReasonCode | null;
  userMessage?: string | null;
  availableFrom?: string | null;
  allRequiredStepsComplete?: boolean;
}
```

### Output

```typescript
interface QuestAction {
  label: string;                 // Button text
  actionType: QuestActionType;  // Semantic type for routing
  enabled: boolean;              // Interactive?
  isMutation: boolean;           // Triggers network call?
  disabledReason?: string;       // Shown when enabled=false
  accessibilityLabel?: string;   // VoiceOver/TalkBack label
}
```

---

## Action Type to Route Mapping

| `actionType` | Navigation |
|---|---|
| `start` | `startQuest()` mutation → `router.replace('/quest-active/' + id)` |
| `continue` | `router.push('/quest-active/' + id)` |
| `submit_proof` | `router.push('/quest-proof/' + id)` |
| `view_submission` | `router.push('/quest-proof/' + id)` (read-only mode) |
| `resubmit` | `router.push('/quest-proof/' + id)` (resubmission mode) |
| `view_completion` | `router.push('/quest-completion/' + id)` |
| `unavailable` | No navigation — show `disabledReason` |
| `view` | `router.push('/quest-detail/' + id)` |

---

## Rules

1. **Call once per screen**, store the result in a constant.
2. **Never duplicate resolver logic** in component render paths.
3. `isMutation: true` → the UI should show a loading spinner after tap.
4. `isMutation: false` → the tap is a navigation action; no spinner needed at trigger site.
5. `enabled: false` + `disabledReason` → show reason as caption below the button.
6. `userMessage` from `QuestAvailabilityResult` takes precedence over `reasonCode` in ineligible messaging.

---

## Helper: participationUrgencyRank

```typescript
import { participationUrgencyRank } from '@/features/quests/utils/questActionResolver';

const ranked = participations.sort(
  (a, b) => participationUrgencyRank(b.status) - participationUrgencyRank(a.status)
);
const dominant = ranked[0];
```

Used by Quest Home to select the dominant active panel from multiple participations.
