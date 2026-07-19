# Hunt Clue UI — Worlds (Prompt 13)

## Overview

Clue content is the most privileged data in the Active Hunt flow. Authorized clue content is served only for revealed stops and displayed only in `CurrentCluePanel`.

## Clue Authorization Model

From `fetchActiveHunt` (repository):
```
authorizedProgress = stopProgress.filter(status !== 'not_started' && status !== 'locked')
```

Clue content is included only when:
- `prog.status !== 'not_started'`
- `prog.status !== 'locked'`
- `stop.hunt_clues[0]` exists and `is_active === true`

## `ActiveHuntClue` Type

```typescript
interface ActiveHuntClue {
  id: string
  clueText: string | null      // null when no text clue
  imageUrl: string | null      // null until signed URL resolved
  visibilityState: ClueVisibilityState   // 'revealed' | 'completed'
  hintAvailable: boolean       // true when hint_text exists (text NOT included)
  revealRule: ClueRevealRule   // 'on_stop_reveal' | 'on_request' | 'timed'
}
```

## `ClueVisibilityState` Values

| State | Meaning |
|-------|---------|
| `hidden` | Not authorized — never sent to client |
| `available` | Authorized but not yet shown to user |
| `revealed` | Currently shown to user |
| `completed` | Stop completed — clue shown with completion styling |
| `expired` | Stop expired — clue no longer shown |

Only `revealed` and `completed` states result in clue content being displayed.

## `CurrentCluePanel` Rules

1. **Plain text only** — no markdown, no HTML rendering
2. **Image fallback** — if image fails to load, graceful fallback (no broken image)
3. **Alt text required** — all clue images have descriptive `accessibilityLabel`
4. **Safety note displayed** — `stop.safetyNote` shown in amber warning row below clue
5. **No future clue leakage** — never shows any content from locked/future stops
6. **No logging** — clue text and images are never logged to analytics

## Ordered Hunt: Stop Number Display

For ordered hunts, `CurrentCluePanel` shows "Stop N of M" label above the stop title. This helps users track progress without needing to open the progress summary.

## Hint System (Future)

`hintAvailable: true` indicates a hint exists but `hint_text` is NOT included in `ActiveHuntClue`. Requesting a hint requires an explicit action (future: with a point penalty). The hint system is not implemented in Prompt 13.

## Image URL Resolution

Clue image URLs come from `media_assets` and are signed private URLs. The repository currently returns `imageUrl: null` for clue images (placeholder for a future signed URL resolution step). When the media service integration is fully wired, image URLs will be resolved via the media service before being returned to the client.

## Accessibility

- `CurrentCluePanel` stop title has `accessibilityRole="header"`
- Clue images have `accessibilityLabel` describing the stop name
- Safety warnings have `accessibilityRole="alert"` (via parent View)
- All text elements use the theme's contrast-compliant color tokens
