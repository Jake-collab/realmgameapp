# Quest Proof UI — Worlds

How proof collection adapts to each quest's configured `proof_type`.

---

## Proof Types and Required Fields

| `proof_type` | Text | Image | Location |
|---|---|---|---|
| `none` | — | — | — |
| `text` | ✓ (min 10 chars) | — | — |
| `image` | — | ✓ | — |
| `location` | — | — | ✓ |
| `image_and_location` | — | ✓ | ✓ |
| `text_and_image` | ✓ | ✓ | — |
| `manual_confirmation` | — | — | — |

The `Quest Proof` screen shows **only** the fields relevant to the quest's `proof_type`. Irrelevant inputs are never rendered.

---

## Screen States

### Draft Mode (first submission)
- Renders empty inputs for required fields
- Submit button disabled until all required fields are filled
- Character counter shown for text inputs

### Resubmission Mode
- `SubmissionStatus(needs_resubmission)` shown at top
- Reviewer feedback shown in `reviewNotes` (safe content only)
- All fields cleared for new evidence
- Button label: **"Resubmit Proof"**

### Under Review (read-only)
- `SubmissionStatus(under_review)` shown
- Inputs are hidden — submission is immutable
- User instructed to wait for notification

---

## Validation Rules

| Field | Rule |
|---|---|
| Text | Minimum 10 characters, maximum 2000 characters |
| Image | One image required (no minimum pixel size enforced client-side) |
| Location | `locationCaptured = true` after user taps capture and GPS confirms |

`canSubmit` is computed synchronously. The submit button activates immediately when all required fields pass.

---

## Point Award Timing

- `auto` completion mode → points awarded after successful submission
- `manual_review` mode → points awarded only after reviewer approval
- **Never** show confirmed point awards until `QuestCompletionResult.success === true`
- The Proof screen shows `"Points awarded after reviewer approval"` for `manual_review` quests

---

## Location Check-In (Prompt 10)

The location input is currently a stub that alerts users the feature is coming. Full implementation wires to `expo-location` and the `quest_geofences` server-side validation in the Geo-Quest prompt.

The location data flow:
1. `expo-location` requests foreground permission
2. `getCurrentPositionAsync()` with 10-second timeout
3. Coordinates sent in proof draft (never stored beyond participation context)
4. Server-side Edge Function validates against `quest_geofences` (never client-side)

---

## Security

- `review_notes` is only rendered on `needs_resubmission` status — never on `rejected` or `approved`
- Precise coordinates are never logged or stored in client state
- Image URIs are local-only; actual upload to Supabase Storage is wired in the Storage prompt
- Users can only submit proof for their own participation (enforced by RLS at service layer)
