# Quest Accessibility — Worlds

Accessibility guidance for all quest screens and components.

---

## Screen Reader Requirements

### Quest Cards and List Items
- Every interactive card has `accessibilityLabel` that combines: Quest title + type + points
- Example: `"Daily Quest: Find the hidden marker. 150 points."`
- `accessibilityRole="button"` on all tappable surfaces

### QuestTypeBadge
- `accessibilityLabel="Quest type: Daily"` (or Monthly Drop, Geo-Quest)
- Not focusable when used decoratively inside a labelled card

### DifficultyBadge
- `accessibilityLabel="Difficulty: Medium"`
- Dots variant: same label, visual-only dots

### AvailabilityNotice
- Full status sentence: `"Quest status: In Progress"` or `"Quest status: Upcoming. Available Aug 1."`

### ActiveQuestPanel
- Button label: `"Continue Quest — Find the hidden marker"`
- Combines action + quest title for context

### QuestObjectiveView
- `"Step 2: Visit the waterfall. Completed."` for screen readers
- `accessibilityRole="text"` (read-only) or none when nested in interactive container

### SafetyNotice
- `accessibilityRole="text"` with full content in `accessibilityLabel`

### SubmissionStatus
- Full status + message in `accessibilityLabel`

---

## Focus Management

### Quest Detail → Start Quest
- After `Start Quest` is tapped and navigation to Active Quest completes, focus returns to the top of the new screen automatically via Expo Router

### Modals
- `ConfirmationModal` uses React Native `Modal` which traps focus automatically on iOS/Android

### Error States
- Error messages use `accessibilityRole="alert"` where appropriate (to be added when error boundaries are wired)

---

## Color Independence

All status indicators use **both** color and an icon or text label:
- `AvailabilityNotice`: colored chip + icon + text label
- `DifficultyBadge`: colored background + text
- `SubmissionStatus`: colored background + icon + text message
- `QuestObjectiveView` completion: icon changes (circle → check-circle) + strikethrough text

No status is communicated via color alone.

---

## Touch Targets

- All interactive elements have minimum touch target 44×44 points
- `hitSlop` applied to small icon buttons: `{ top: 10, bottom: 10, left: 10, right: 10 }`
- Primary action buttons span full width (easy target)

---

## Text Scaling

- All text uses `fontFamily` and `fontSize` tokens — supports Dynamic Type on iOS
- `numberOfLines` limits are applied only where overflow is intentional (cards), not on legal or safety text
- `SafetyNotice` and `ProofRequirementSummary` never truncate

---

## Keyboard / Hardware Input

- `TextInput` fields in proof screen use `returnKeyType="done"` / `"next"` as appropriate
- `KeyboardAvoidingView` wraps the Proof screen for correct scroll behavior
- `keyboardShouldPersistTaps="handled"` on proof screen ScrollView

---

## Checklist Before Shipping a New Quest Screen

- [ ] All interactive elements have `accessibilityLabel` + `accessibilityRole`
- [ ] Status communicated via color + text/icon (not color alone)
- [ ] Touch targets ≥ 44pt (use `hitSlop` if needed)
- [ ] `SafetyNotice` and accessibility notes never truncated
- [ ] Loading states communicate to screen readers (text or `accessibilityLiveRegion`)
- [ ] Modal focus trapping verified on both iOS and Android
